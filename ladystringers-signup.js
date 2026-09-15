(function () {
  "use strict";

  var subscribeUrl = "https://assets.mailerlite.com/jsonp/2619900/forms/198637427657540637/subscribe";
  var activeRequest = null;
  var emailPattern = /^([a-zA-Z0-9_.+-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]){2,40}$/;

  function exactText(element) {
    return (element.textContent || "").trim();
  }

  function findModal(form) {
    var current = form;
    while (current && current !== document.body) {
      if (current.classList && current.classList.contains("fixed") && current.classList.contains("z-50")) return current;
      current = current.parentElement;
    }
    return form.parentElement;
  }

  function removeBypasses(modal) {
    var bypasses = Array.prototype.filter.call(modal.querySelectorAll("button, a"), function (element) {
      var text = exactText(element);
      return text === "Continue Without Email" || text === "Download Instead";
    });

    bypasses.forEach(function (element) {
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
      element.tabIndex = -1;
      if (element.parentElement && Array.prototype.every.call(element.parentElement.children, function (child) {
        return bypasses.indexOf(child) !== -1;
      })) element.parentElement.hidden = true;
    });
  }

  function findPdfUrl(modal) {
    var link = Array.prototype.find.call(modal.querySelectorAll("a[href]"), function (element) {
      return /\.pdf(?:$|[?#])/i.test(element.href);
    });
    return link ? link.href : "";
  }

  function getStatus(form) {
    var status = form.querySelector("[data-ladystringers-signup-status]");
    if (!status) {
      status = document.createElement("p");
      status.dataset.ladystringersSignupStatus = "true";
      status.className = "text-red-400 text-sm";
      status.setAttribute("role", "alert");
      status.setAttribute("aria-live", "polite");
      form.insertBefore(status, form.querySelector('button[type="submit"]'));
    }
    return status;
  }

  function setBusy(form, isBusy) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    if (input) input.disabled = isBusy;
    if (button) {
      button.disabled = isBusy;
      button.textContent = isBusy ? "Subscribing..." : "Subscribe & Open Journal";
    }
  }

  function clearRequest() {
    if (!activeRequest) return;
    window.clearTimeout(activeRequest.timeout);
    if (activeRequest.script && activeRequest.script.parentNode) activeRequest.script.parentNode.removeChild(activeRequest.script);
  }

  function fail(message) {
    if (!activeRequest) return;
    clearRequest();
    setBusy(activeRequest.form, false);
    getStatus(activeRequest.form).textContent = message;
    activeRequest = null;
  }

  function unlockJournal(request) {
    var modal = request.modal;
    var form = request.form;
    var heading = modal.querySelector("h2");
    var description = heading && heading.parentElement ? heading.parentElement.querySelector("p") : null;
    var formParent = form.parentElement;

    if (heading) heading.textContent = "Thank You";
    if (description) description.textContent = "You're all set! Your journal is ready to open.";
    form.hidden = true;

    var accessLink = document.createElement("a");
    accessLink.href = request.pdfUrl;
    accessLink.target = "_blank";
    accessLink.rel = "noopener noreferrer";
    accessLink.textContent = "Open Journal";
    accessLink.className = "block w-full min-h-[44px] bg-[#D4AF37] hover:bg-[#C4A484] text-[#080A12] font-medium py-6 text-base text-center rounded-lg transition-all duration-300";
    accessLink.dataset.ladystringersJournalAccess = "true";
    formParent.insertBefore(accessLink, form.nextSibling);
    accessLink.focus();
    accessLink.click();
  }

  function submitToMailerLite(form, modal, email, pdfUrl) {
    var status = getStatus(form);
    var script = document.createElement("script");
    var params = new URLSearchParams();

    status.textContent = "";
    setBusy(form, true);
    params.set("fields[email]", email);
    params.set("ml-submit", "1");
    params.set("anticsrf", "true");
    params.set("ajax", "1");
    params.set("guid", "");
    params.set("callback", "mlWebformSubmitted");
    params.set("_", String(Date.now()));

    activeRequest = { form: form, modal: modal, pdfUrl: pdfUrl, script: script, timeout: null };
    activeRequest.timeout = window.setTimeout(function () {
      fail("We couldn't complete your signup. Please check your connection and try again—your email is still in the box.");
    }, 15000);

    window.mlWebformSubmitted = function (response) {
      if (!activeRequest) return;
      var request = activeRequest;
      clearRequest();
      activeRequest = null;
      if (response && response.success) {
        unlockJournal(request);
      } else {
        activeRequest = request;
        fail("We couldn't complete your signup. Please try again—your email is still in the box.");
      }
    };

    script.onerror = function () {
      fail("We couldn't reach the signup service. Please check your connection and try again—your email is still in the box.");
    };
    script.src = subscribeUrl + "?" + params.toString();
    document.head.appendChild(script);
  }

  function connectForm(form) {
    if (form.dataset.mailerLiteConnected) return;
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    if (!input || !button || exactText(button) !== "Subscribe & Open Journal") return;

    var modal = findModal(form);
    var pdfUrl = findPdfUrl(modal);
    if (!pdfUrl) return;

    form.dataset.mailerLiteConnected = "true";
    form.noValidate = true;
    input.required = true;
    input.autocomplete = "email";
    removeBypasses(modal);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      var value = input.value.trim();
      var status = getStatus(form);

      if (!value) {
        status.textContent = "Please enter your email address.";
        input.focus();
        return;
      }
      if (!emailPattern.test(value)) {
        status.textContent = "Please enter a valid email address.";
        input.focus();
        return;
      }
      if (button.disabled || activeRequest) return;
      submitToMailerLite(form, modal, value, pdfUrl);
    }, true);
  }

  function scan() {
    document.querySelectorAll("form").forEach(connectForm);
    document.querySelectorAll("button, a").forEach(function (element) {
      var text = exactText(element);
      if (text === "Continue Without Email" || text === "Download Instead") {
        var form = element.closest("div").parentElement.querySelector("form");
        if (form) removeBypasses(findModal(form));
      }
    });
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
