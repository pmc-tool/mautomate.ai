"use client"

import { useParams } from "next/navigation"
import { PostEditor } from "../post-editor"

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>()
  const id = typeof params?.id === "string" ? params.id : ""
  if (!id) return null
  return <PostEditor postId={id} />
}
