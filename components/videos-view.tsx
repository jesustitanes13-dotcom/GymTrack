"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { storageService } from "@/lib/storage"
import type { Video } from "@/lib/types"
import { Plus, Trash2, Play, ExternalLink } from "lucide-react"
import { getVideoThumbnail, isVideoUrl } from "@/lib/utils-video"
import VideoModal from "./video-modal"

interface VideosViewProps {
  dataVersion: number
}

export default function VideosView({ dataVersion }: VideosViewProps) {
  const [videos, setVideos] = useState<Video[]>([])
  const [newVideoName, setNewVideoName] = useState("")
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

  useEffect(() => {
    setVideos(storageService.getVideos())
  }, [dataVersion])

  const addVideo = () => {
    if (!newVideoName.trim() || !newVideoUrl.trim()) return
    if (!isVideoUrl(newVideoUrl)) {
      alert("Por favor ingresa una URL válida de video (YouTube, Instagram o archivo .mp4)")
      return
    }

    const newVideo: Video = {
      id: Date.now().toString(),
      name: newVideoName,
      url: newVideoUrl,
      uploadedAt: new Date().toISOString(),
    }

    storageService.addVideo(newVideo)
    setVideos([...videos, newVideo])
    setNewVideoName("")
    setNewVideoUrl("")
  }

  const deleteVideo = (id: string) => {
    storageService.deleteVideo(id)
    setVideos(videos.filter((v) => v.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2 text-balance">Mis Videos</h2>
        <p className="text-muted-foreground">Guarda videos de referencia para tus ejercicios</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Añadir nuevo video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="video-name">Nombre del video</Label>
              <Input
                id="video-name"
                placeholder="Ej: Técnica de sentadilla"
                value={newVideoName}
                onChange={(e) => setNewVideoName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-url">URL del video</Label>
              <Input
                id="video-url"
                placeholder="YouTube, Instagram o .mp4"
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={addVideo} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Añadir video
          </Button>
          <p className="text-xs text-muted-foreground">
            Puedes pegar URLs de YouTube, Instagram o archivos .mp4 directos
          </p>
        </CardContent>
      </Card>

      {videos.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No tienes videos guardados aún</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden group">
              <div className="relative aspect-video bg-muted">
                <img
                  src={getVideoThumbnail(video.url) || "/placeholder.svg"}
                  alt={video.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => setSelectedVideo(video.url)}>
                    <Play className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => window.open(video.url, "_blank")}>
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-sm line-clamp-2">{video.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {new Date(video.uploadedAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => deleteVideo(video.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedVideo && <VideoModal videoUrl={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  )
}
