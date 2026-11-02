async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {"Content-Type": "application/json", ...(options.headers || {})},
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Произошла ошибка");
  return data;
}
function showError(el, message) {
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
}
