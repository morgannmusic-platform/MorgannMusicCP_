// Pagination JS pour catalogue/sorties.html
export function paginateReleases(releases, pageSize) {
  const pages = [];
  for (let i = 0; i < releases.length; i += pageSize) {
    pages.push(releases.slice(i, i + pageSize));
  }
  return pages;
}
