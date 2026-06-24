export function getInstallUrl(): string {
  const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (slug) {
    return `https://github.com/apps/${slug}/installations/new`;
  }

  const url = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL;
  if (url) return url;

  return "https://github.com/apps/mergegraph/installations/new";
}