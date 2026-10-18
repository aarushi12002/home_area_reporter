"use strict";
const button = document.getElementById("research");
(async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = new URL(tab.url);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)(redfin|zillow)\.com$/.test(url.hostname)
    )
      throw new Error("Open a Redfin or Zillow property listing first.");
    document.getElementById("context").textContent =
      "Confirm the listing ZIP to open Seattle area research. Your listing stays open.";
    button.disabled = false;
    button.onclick = () => {
      try {
        const zip = document.getElementById("zip").value.trim();
        if (!/^98\d{3}$/.test(zip))
          throw new Error(
            "Enter a five-digit Seattle-area ZIP beginning with 98.",
          );
        const origin = new URL(document.getElementById("origin").value);
        if (
          origin.username ||
          origin.password ||
          origin.search ||
          origin.hash ||
          origin.pathname !== "/"
        )
          throw new Error(
            "Enter the website origin only, without a path or credentials.",
          );
        if (
          origin.protocol !== "https:" &&
          !(
            origin.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(origin.hostname)
          )
        )
          throw new Error("Use HTTPS, or localhost for development.");
        const target = new URL("/report", origin.origin);
        target.searchParams.set("zip", zip);
        chrome.tabs.create({ url: target.href });
      } catch (error) {
        document.getElementById("error").textContent = error.message;
      }
    };
  } catch (error) {
    document.getElementById("error").textContent = error.message;
  }
})();
