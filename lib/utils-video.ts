export function getVideoThumbnail(url: string): string {
  const youtubeId = getYouTubeId(url)
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
  }

  // Instagram - placeholder
  if (url.includes("instagram.com")) {
    return "/instagram-video.png"
  }

  // TikTok - placeholder
  if (url.includes("tiktok.com")) {
    return "/video-thumbnail.png"
  }

  // MP4 or other
  if (url.endsWith(".mp4") || url.endsWith(".mov")) {
    return "/video-thumbnail.png"
  }

  return "/video-production-setup.png"
}

export function getVideoEmbedUrl(url: string): string {
  const youtubeId = getYouTubeId(url)
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?playsinline=1`
  }

  // TikTok
  const tiktokRegex = /tiktok\.com\/(?:@[^/]+\/video\/|v\/)(\d+)/
  const tiktokMatch = url.match(tiktokRegex)
  if (tiktokMatch) {
    return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`
  }

  // Instagram - return original
  if (url.includes("instagram.com")) {
    return url
  }

  // Direct video file
  return url
}

export function isVideoUrl(url: string): boolean {
  if (!url) return false
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("youtube-nocookie.com") ||
    url.includes("instagram.com") ||
    url.includes("tiktok.com") ||
    url.endsWith(".mp4") ||
    url.endsWith(".mov") ||
    url.endsWith(".webm")
  )
}

function getYouTubeId(url: string): string | null {
  const normalized = url.startsWith("http") ? url : `https://${url}`
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return null
  }

  const hostname = parsed.hostname.replace("www.", "")
  const isYouTubeDomain =
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "music.youtube.com" ||
    hostname === "youtube-nocookie.com"

  if (!isYouTubeDomain) return null

  let id: string | null = null
  if (hostname === "youtu.be") {
    id = parsed.pathname.split("/")[1] || null
  } else if (parsed.pathname.startsWith("/watch")) {
    id = parsed.searchParams.get("v")
  } else if (parsed.pathname.startsWith("/shorts/")) {
    id = parsed.pathname.split("/")[2] || null
  } else if (parsed.pathname.startsWith("/live/")) {
    id = parsed.pathname.split("/")[2] || null
  } else if (parsed.pathname.startsWith("/embed/")) {
    id = parsed.pathname.split("/")[2] || null
  } else if (parsed.pathname.startsWith("/v/")) {
    id = parsed.pathname.split("/")[2] || null
  }

  const match = id?.match(/[a-zA-Z0-9_-]{11}/)
  return match ? match[0] : null
}
