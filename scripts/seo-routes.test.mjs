import assert from "node:assert/strict";
import test from "node:test";

const {
  getArtistPath,
  getCanonicalArtistSlug,
  getArtistSlug,
  getConcertDescription,
  getConcertName,
  getConcertPath,
  getConcertRoutes,
  getConcertSlug,
  getConcertSlugMap,
  getLegacyConcertSlugs,
  slugify,
} = await import("../lib/seo-routes.ts");

const doechii = {
  videoId: "-91vymvIH0c",
  artist: "Doechii",
  sourceTitle: "Doechii: Tiny Desk Concert",
};

const danielCaesarNpr = {
  videoId: "PBKa-AAy_vo",
  artist: "Daniel Caesar",
  sourceTitle: "Daniel Caesar: NPR Music Tiny Desk Concert",
};

const danielCaesar = {
  videoId: "rMWjbb2l5BE",
  artist: "Daniel Caesar",
  sourceTitle: "Daniel Caesar: Tiny Desk Concert",
};

test("normalizes artist and concert slugs", () => {
  assert.equal(slugify("Anderson .Paak & The Free Nationals"), "anderson-paak-and-the-free-nationals");
  assert.equal(getArtistSlug("Doechii"), "doechii");
  assert.equal(getArtistPath("Doechii"), "/artists/doechii");
  assert.equal(getConcertName(doechii), "Tiny Desk Concert");
  assert.equal(getConcertSlug(doechii), "doechii-tiny-desk");
  assert.equal(getConcertPath(doechii), "/concerts/doechii-tiny-desk");
});

test("numbers repeated artist and concert identities deterministically", () => {
  assert.equal(getCanonicalArtistSlug("daniel-ceasar"), "daniel-caesar");
  assert.equal(getArtistPath("Daniel Caesar"), "/artists/daniel-caesar");
  const slugs = getConcertSlugMap([danielCaesarNpr, danielCaesar]);
  assert.equal(slugs[danielCaesarNpr.videoId], "daniel-caesar-tiny-desk-1");
  assert.equal(slugs[danielCaesar.videoId], "daniel-caesar-tiny-desk-2");
  assert.equal(getConcertPath(danielCaesarNpr, [danielCaesarNpr, danielCaesar]), "/concerts/daniel-caesar-tiny-desk-1");
  assert.equal(getConcertPath(danielCaesar, [danielCaesarNpr, danielCaesar]), "/concerts/daniel-caesar-tiny-desk-2");
  assert.deepEqual(getLegacyConcertSlugs(danielCaesarNpr), [
    "daniel-caesar-npr-music-tiny-desk",
    "daniel-caesar-tiny-desk-pbka-aay-vo",
  ]);
});

test("uses numeric occurrences for duplicate concert slugs", () => {
  const duplicate = { ...doechii, videoId: "second-doechii-video" };
  const routes = getConcertRoutes([doechii, duplicate]);

  assert.deepEqual(routes.map((route) => route.slug), [
    "doechii-tiny-desk-1",
    "doechii-tiny-desk-2",
  ]);
});

test("builds a useful concert description", () => {
  assert.match(getConcertDescription(doechii), /Doechii/);
  assert.match(getConcertDescription(doechii), /song by song/);
  assert.match(getConcertDescription(doechii), /playable song clips/);
  assert.match(getConcertDescription({ ...doechii, songs: [] }), /available concert details/);
});
