function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return realIp.trim();
  }

  return "";
}

function normalizeIp(ip) {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}

function isLikelyTrainIsp(value) {
  return String(value || "").toLowerCase().includes("icomera");
}

export default async function handler(req, res) {
  try {
    const ip = normalizeIp(getClientIp(req));

    if (!ip) {
      return res.status(400).json({
        error: "Could not determine client IP"
      });
    }

    const response = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
    if (!response.ok) {
      return res.status(502).json({
        error: `IP lookup failed with status ${response.status}`
      });
    }

    const data = await response.json();
    const isp = data.org || data.company?.name || "";

    return res.status(200).json({
      ip,
      isp,
      isTrainLikely: isLikelyTrainIsp(isp),
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}