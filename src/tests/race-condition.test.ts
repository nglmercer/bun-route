import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { Router } from "../index"

describe("Race Condition Fix - responded flag", () => {
    test("should not run catch-all route when middleware sends response", async () => {
        const router = new Router()
        
        // Middleware that sends a response
        router.use("*", "/api/**", (ctx) => {
            ctx.res.send("API Response")
            // Don't return anything - response is sent via ctx.res.send()
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/api/test")
        const body = await response.text()
        
        expect(body).toBe("API Response")
        expect(response.status).toBe(200)
    })
    
    test("should not run catch-all route when middleware calls sendJson", async () => {
        const router = new Router()
        
        // Middleware that sends JSON
        router.use("*", "/api/**", (ctx) => {
            ctx.res.sendJson({ message: "API Response" })
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/api/test")
        const body = await response.json()
        
        expect(body).toEqual({ message: "API Response" })
    })
    
    test("should not run catch-all route when middleware calls sendFile", async () => {
        const router = new Router()
        
        // Create a test file
        const testFile = Bun.file("/tmp/test-file.txt")
        await Bun.write(testFile, "File Content")
        
        // Middleware that sends a file
        router.use("*", "/files/**", (ctx) => {
            ctx.res.sendFile(testFile)
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/files/test.txt")
        const body = await response.text()
        
        expect(body).toBe("File Content")
        
        // Cleanup
        await Bun.file("/tmp/test-file.txt").delete()
    })
    
    test("should not run catch-all route when middleware calls sendHtml", async () => {
        const router = new Router()
        
        // Middleware that sends HTML
        router.use("*", "/page/**", (ctx) => {
            ctx.res.sendHtml("<h1>Page</h1>")
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/page/test")
        const body = await response.text()
        
        expect(body).toBe("<h1>Page</h1>")
    })
    
    test("should not run catch-all route when middleware calls sendText", async () => {
        const router = new Router()
        
        // Middleware that sends text
        router.use("*", "/text/**", (ctx) => {
            ctx.res.sendText("Text Response")
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/text/test")
        const body = await response.text()
        
        expect(body).toBe("Text Response")
    })
    
    test("should not run catch-all route when middleware calls sendError", async () => {
        const router = new Router()
        
        // Middleware that sends error
        router.use("*", "/error/**", (ctx) => {
            ctx.res.sendError("Error occurred", 500)
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/error/test")
        const body = await response.json()
        
        expect(body).toEqual({ error: "Error occurred", status: 500 })
    })
    
    test("should not run catch-all route when middleware calls sendRedirect", async () => {
        const router = new Router()
        
        // Middleware that redirects
        router.use("*", "/redirect/**", (ctx) => {
            ctx.res.sendRedirect("/new-location")
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/redirect/test")
        
        expect(response.status).toBe(307)
        expect(response.headers.get("location")).toBe("/new-location")
    })
    
    test("should not run catch-all route when middleware calls sendNoContent", async () => {
        const router = new Router()
        
        // Middleware that sends no content
        router.use("*", "/no-content/**", (ctx) => {
            ctx.res.sendNoContent()
        })
        
        // Catch-all route that should NOT run
        router.get("/**", (ctx) => {
            return new Response("Catch-all Response")
        })
        
        const response = await router.request("/no-content/test")
        
        expect(response.status).toBe(204)
    })
})
