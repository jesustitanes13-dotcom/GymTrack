export function getVideoThumbnail(url: string): string {
  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  const youtubeMatch = url.match(youtubeRegex)
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`
  }

  // Instagram - placeholder
  if (url.includes("instagram.com")) {
    return "/instagram-video.png"
  }

  // MP4 or other
  if (url.endsWith(".mp4") || url.endsWith(".mov")) {
    return "/video-thumbnail.png"
  }

  return "/video-production-setup.png"
}

export function getVideoEmbedUrl(url: string): string {
  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  const youtubeMatch = url.match(youtubeRegex)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
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
    url.includes("instagram.com") ||
    url.endsWith(".mp4") ||
    url.endsWith(".mov") ||
    url.endsWith(".webm")
  )
}
