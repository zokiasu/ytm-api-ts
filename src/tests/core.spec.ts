import { afterAll, beforeAll, describe, it } from "bun:test"
import { equal } from "assert"
import { z } from "zod"

import { ZodError, ZodType } from "zod"
import YTMusic from "../YTMusic"
import {
	AlbumDetailed,
	AlbumFull,
	ArtistDetailed,
	ArtistFull,
	PlaylistDetailed,
	PlaylistFull,
	SearchResult,
	SongDetailed,
	SongFull,
	VideoDetailed,
	VideoFull,
} from "../types"

const errors: ZodError[] = []
const BLACKPINK_ID = "UCkbbMCA40i18i7UdjayMPAg"

const expect = (data: any, type: ZodType) => {
	const result = type.safeParse(data)

	if (result.error) {
		errors.push(result.error)
	} else {
		const empty = JSON.stringify(result.data).match(/"\w+":""/g)
		if (empty) {
			console.log(result.data, empty)
		}
		equal(empty, null)
	}

	equal(result.error, undefined)
}

const ytmusic = new YTMusic()
beforeAll(() => ytmusic.initialize())

describe("BLACKPINK Tests", () => {
	it("Get artist details", async () => {
		const artist = await ytmusic.getArtist(BLACKPINK_ID)
		expect(artist, ArtistFull)
		console.log("Artist details:", JSON.stringify(artist, null, 2))
	})

	it("Get singles", async () => {
		const singles = await ytmusic.getArtistSingles(BLACKPINK_ID)
		expect(singles, z.array(AlbumDetailed))
		console.log("Singles:", JSON.stringify(singles, null, 2))
	})

	it("Get albums", async () => {
		const albums = await ytmusic.getArtistAlbums(BLACKPINK_ID)
		expect(albums, z.array(AlbumDetailed))
		console.log("Albums:", JSON.stringify(albums, null, 2))
	})

	it("Get songs", async () => {
		const songs = await ytmusic.getArtistSongs(BLACKPINK_ID)
		expect(songs, z.array(SongDetailed))
		console.log("Songs:", JSON.stringify(songs, null, 2))
	})
})

afterAll(() => console.log("Issues:", errors))
