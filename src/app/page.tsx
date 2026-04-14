import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">Gates Prototype</span>
          <Badge variant="secondary">v0.1</Badge>
        </div>
        <nav className="flex items-center gap-3">
          <Button variant="ghost" size="sm">Docs</Button>
          <Button size="sm">Get Started</Button>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20 space-y-16">
        <section className="text-center space-y-4">
          <Badge className="mb-2">shadcn/ui + Next.js</Badge>
          <h1 className="text-5xl font-bold tracking-tight">
            Gates User Prototype
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            A clean starting point built with Next.js App Router, Tailwind CSS, and shadcn/ui components.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button size="lg">Start Building</Button>
            <Button size="lg" variant="outline">View Docs</Button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next.js App Router</CardTitle>
              <CardDescription>File-based routing with layouts and server components</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">React 19</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">shadcn/ui</CardTitle>
              <CardDescription>Accessible, composable components you own</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Radix UI</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tailwind CSS v4</CardTitle>
              <CardDescription>Utility-first styling with zero config</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">PostCSS</Badge>
            </CardContent>
          </Card>
        </section>

        <section className="max-w-md mx-auto space-y-3">
          <h2 className="text-xl font-semibold text-center">Stay in the loop</h2>
          <div className="flex gap-2">
            <Input placeholder="your@email.com" type="email" />
            <Button>Subscribe</Button>
          </div>
        </section>
      </main>
    </div>
  );
}
