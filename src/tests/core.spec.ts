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

describe("Song Tests", () => {
	// IDs de test
	const VALID_SONG_ID = "kNITt0i55NI"
	const INVALID_SONG_ID = "invalid_id"
	const PROBLEMATIC_IDS = [
		"LZWAn1xloC4",  // ID problématique 1
		"XiKfq1BTNGU",  // ID problématique 2
	]
	
	it("Should get song details with valid ID", async () => {
		const song = await ytmusic.getSong(VALID_SONG_ID)
		expect(song, SongFull)
		console.log("Song details:", JSON.stringify(song, null, 2))
	})

	it("Should handle invalid song ID", async () => {
		try {
			await ytmusic.getSong(INVALID_SONG_ID)
			throw new Error("Should have thrown an error for invalid ID")
		} catch (error) {
			equal((error as Error).message.includes("Invalid videoId"), true)
		}
	})

	it("Should handle API errors gracefully", async () => {
		const NON_EXISTENT_ID = "xxxxxxxxxxx"
		try {
			await ytmusic.getSong(NON_EXISTENT_ID)
			throw new Error("Should have thrown an error for non-existent song")
		} catch (error) {
			equal((error as Error).message.includes("Failed to get song"), true)
		}
	})

	describe("Problematic IDs Tests", () => {
		for (const videoId of PROBLEMATIC_IDS) {
			it(`Should handle problematic ID: ${videoId}`, async () => {
				try {
					const song = await ytmusic.getSong(videoId)
					expect(song, SongFull)
					console.log(`Song details for ${videoId}:`, JSON.stringify(song, null, 2))
				} catch (error) {
					console.error(`Error with ID ${videoId}:`, error)
					throw error
				}
			})
		}

		it("Should get basic info even when player endpoint fails", async () => {
			// Test avec un ID connu pour échouer avec l'endpoint player
			const song = await ytmusic.getSong(PROBLEMATIC_IDS[0])
			expect(song, SongFull)
			equal(typeof song.videoId, "string")
			equal(typeof song.name, "string")
			console.log("Fallback song details:", JSON.stringify(song, null, 2))
		})
	})
})

afterAll(() => console.log("Issues:", errors))
