import { ApiError, request } from "@/lib/api"

export type PostStatus = "draft" | "published"

export type Post = {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  status: PostStatus
  published_at?: string | null
  created_at: string
}

export type PostsResponse = {
  posts: Post[]
}

export type PostInput = {
  title: string
  slug: string
  excerpt: string
  content: string
  status: PostStatus
}

export async function listPosts(token: string): Promise<PostsResponse> {
  return request<PostsResponse>("/admin/platform/blog", { token })
}

export async function createPost(token: string, input: PostInput): Promise<Post> {
  return request<Post>("/admin/platform/blog", { method: "POST", token, body: input })
}

export async function updatePost(
  token: string,
  id: string,
  input: PostInput
): Promise<Post> {
  return request<Post>(`/admin/platform/blog/${id}`, { method: "PUT", token, body: input })
}

export async function deletePost(token: string, id: string): Promise<void> {
  await request<void>(`/admin/platform/blog/${id}`, { method: "DELETE", token })
}
