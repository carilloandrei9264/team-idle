export default function health(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ status: "ok", version: "1.4.0", region: "sin1" });
}