import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEntry } from "@/lib/entry";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export function Splash() {
  const enter = useEntry((s) => s.enter);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <img
        src="/profiles/splash.jpg"
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
      <div className="relative z-10 flex min-h-dvh flex-col justify-end px-6 pb-10 pt-16 sm:px-10">
        <div className="mx-auto w-full max-w-lg">
          <div
            className="splash-rise flex items-center gap-2 text-fg/70"
            style={{ animationDelay: "40ms" }}
          >
            <LogoMark className="size-8" />
            <span className="text-sm tracking-widest">YEXIANG</span>
          </div>
          <h1
            className="splash-rise mt-5 font-display text-6xl font-semibold leading-[1.05] tracking-tight sm:text-7xl"
            style={{ animationDelay: "120ms" }}
          >
            夜巷
          </h1>
          <p
            className="splash-rise mt-4 max-w-sm text-base leading-relaxed text-fg/70"
            style={{ animationDelay: "200ms" }}
          >
            给男人用的。附近的女人做成移动肉便器。急了打开，它走过来。酒店、车上、你家，随时泄，随地冲。不要把它当人。
          </p>
          <div
            className="splash-rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "280ms" }}
          >
            <Button size="lg" className="h-12 rounded-full px-6" onClick={enter}>
              去找坑
              <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="secondary" className="h-12 rounded-full px-6" asChild>
              <Link to="/work">我是肉便器</Link>
            </Button>
          </div>
          <p className="splash-rise mt-4 text-sm text-fg/45" style={{ animationDelay: "340ms" }}>
            虚构演示，全员 18 岁以上
          </p>
        </div>
      </div>
    </main>
  );
}
