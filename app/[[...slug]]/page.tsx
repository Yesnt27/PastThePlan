import { BookApp } from "./book-app"

/** Every non-API path renders the book; client-side routing takes it from there. */
export default function Page() {
  return <BookApp />
}
