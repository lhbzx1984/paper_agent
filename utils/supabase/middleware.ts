import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  // 在部署环境中若缺少公开环境变量，避免中间件直接崩溃导致 500。
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: Awaited<
    ReturnType<typeof supabase.auth.getUser>
  >["data"]["user"] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err: unknown) {
    const code =
      err &&
      typeof err === "object" &&
      "code" in err &&
      typeof (err as { code?: unknown }).code === "string"
        ? (err as { code: string }).code
        : "";
    // 本地残留 cookie 但 refresh_token 已在服务端失效：清会话并按未登录处理，避免刷屏报错
    if (code === "refresh_token_not_found") {
      try {
        await supabase.auth.signOut();
      } catch {
        /* noop */
      }
      if (process.env.NODE_ENV === "development") {
        console.info(
          "[middleware] 已清除无效登录状态（refresh_token_not_found），请重新登录。",
        );
      }
    } else {
      // Edge 下访问 Supabase 失败（离线、DNS、URL/Key 错误、防火墙等）时避免整站中间件崩溃
      console.error("[middleware] supabase.auth.getUser failed:", err);
    }
  }

  const pathname = request.nextUrl.pathname;

  // Protect dashboard routes (including /projects, /upload, etc.)
  const protectedPaths = [
    "/dashboard",
    "/projects",
    "/upload",
    "/analyze",
    "/skills",
    "/workspace",
    "/data-lab",
    "/paper",
  ];
  const isProtected =
    protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !user;
  if (isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
