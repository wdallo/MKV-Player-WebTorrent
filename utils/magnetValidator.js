// Magnet link validation utility
export function isValidMagnet(url) {
  return (
    typeof url === "string" &&
    /^magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/.test(url)
  );
}
