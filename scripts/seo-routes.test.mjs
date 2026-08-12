import assert from "node:assert/strict";
import test from "node:test";

const {
  getArtistPath,
  getArtistSlug,
  getConcertDescription,
  getConcertName,
  getConcertPath,
  getConcertRoutes,
  getConcertSlug,
  slugify,
} = await import("../lib/seo-routes.ts");

const doechii = {
  videoId: "-91vymvIH0c",
  artist: "Doechii",
  sourceTitle: "Doechii: Tiny Desk Concert",
};

test("normalizes artist and concert slugs", () => {
  assert.equal(slugify("Anderson .Paak & The Free Nationals"), "anderson-paak-and-the-free-nationals");
  assert.equal(getArtistSlug("Doechii"), "doechii");
  assert.equal(getArtistPath("Doechii"), "/artists/doechii");
  assert.equal(getConcertName(doechii), "Tiny Desk Concert");
  assert.equal(getConcertSlug(doechii), "doechii-tiny-desk");
  assert.equal(getConcertPath(doechii), "/concerts/doechii-tiny-desk");
});

test("disambiguates duplicate concert slugs with stable video ids", () => {
  const duplicate = { ...doechii, videoId: "second-doechii-video" };
  const routes = getConcertRoutes([doechii, duplicate]);

  assert.deepEqual(routes.map((route) => route.slug), [
    "doechii-tiny-desk-91vymvih0c",
    "doechii-tiny-desk-second-doechii-video",
  ]);
});

test("builds a useful concert description", () => {
  assert.match(getConcertDescription(doechii), /Doechii/);
  assert.match(getConcertDescription(doechii), /song by song/);
  assert.match(getConcertDescription(doechii), /playable song clips/);
});
