import axios, { AxiosInstance } from "axios"
import { Cookie, CookieJar } from "tough-cookie"

import { FE_MUSIC_HOME } from "./constants"
import AlbumParser from "./parsers/AlbumParser"
import ArtistParser from "./parsers/ArtistParser"
import Parser from "./parsers/Parser"
import PlaylistParser from "./parsers/PlaylistParser"
import SearchParser from "./parsers/SearchParser"
import SongParser from "./parsers/SongParser"
import VideoParser from "./parsers/VideoParser"
import {
	AlbumDetailed,
	AlbumFull,
	ArtistDetailed,
	ArtistFull,
	ArtistReleases,
	HomeSection,
	PlaylistDetailed,
	PlaylistFull,
	ReleaseType,
	SearchResult,
	SongDetailed,
	SongFull,
	UpNextsDetails,
	VideoDetailed,
	VideoFull,
} from "./types"
import { checkTypeStrict } from "./utils/checkType"
import { traverse, traverseList, traverseString } from "./utils/traverse"

axios.defaults.headers.common["Accept-Encoding"] = "gzip"

export default class YTMusic {
	private cookiejar: CookieJar
	private config?: Record<string, string>
	private client: AxiosInstance

	/**
	 * Creates an instance of YTMusic
	 * Make sure to call initialize()
	 */
	public constructor() {
		this.cookiejar = new CookieJar()
		this.config = {}
		this.client = axios.create({
			baseURL: "https://music.youtube.com/",
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.5",
			},
			withCredentials: true,
		})

		this.client.interceptors.request.use(req => {
			if (req.baseURL) {
				const cookieString = this.cookiejar.getCookieStringSync(req.baseURL)
				if (cookieString) {
					req.headers["cookie"] = cookieString
				}
			}

			return req
		})

		this.client.interceptors.response.use(res => {
			if (res.headers && res.config.baseURL) {
				const cookieStrings = res.headers["set-cookie"] || []
				for (const cookieString of cookieStrings) {
					const cookie = Cookie.parse(cookieString)
					if (cookie) {
						this.cookiejar.setCookieSync(cookie, res.config.baseURL)
					}
				}
			}

			return res
		})
	}

	/**
	 * Initializes the API
	 */
	public async initialize(options?: {
		cookies?: string
		GL?: string
		HL?: string
	}) {
		const { cookies, GL, HL } = options ?? {}

		if (cookies) {
			for (const cookieString of cookies.split("; ")) {
				const cookie = Cookie.parse(`${cookieString}`)
				if (!cookie) return

				this.cookiejar.setCookieSync(cookie, "https://www.youtube.com/")
			}
		}

		const html = (await this.client.get("/")).data as string
		const setConfigs = html.match(/ytcfg\.set\(.*\)/) || []

		const configs = setConfigs
			.map(c => c.slice(10, -1))
			.map(s => {
				try {
					return JSON.parse(s)
				} catch {
					return null
				}
			})
			.filter(j => !!j)

		for (const config of configs) {
			this.config = {
				...this.config,
				...config,
			}
		}

		if (!this.config) {
			this.config = {}
		}

		if (GL) this.config.GL = GL
		if (HL) this.config.HL = HL

		return this
	}

	/**
	 * Constructs a basic YouTube Music API request with all essential headers
	 * and body parameters needed to make the API work
	 *
	 * @param endpoint Endpoint for the request
	 * @param body Body
	 * @param query Search params
	 * @returns Raw response from YouTube Music API which needs to be parsed
	 */
	private async constructRequest(
		endpoint: string,
		body: Record<string, any> = {},
		query: Record<string, string> = {},
	) {
		if (!this.config) {
			throw new Error("API not initialized. Make sure to call the initialize() method first")
		}

		const headers: Record<string, any> = {
			...this.client.defaults.headers,
			"x-origin": this.client.defaults.baseURL,
			"X-Goog-Visitor-Id": this.config.VISITOR_DATA || "",
			"X-YouTube-Client-Name": this.config.INNERTUBE_CONTEXT_CLIENT_NAME,
			"X-YouTube-Client-Version": this.config.INNERTUBE_CLIENT_VERSION,
			"X-YouTube-Device": this.config.DEVICE,
			"X-YouTube-Page-CL": this.config.PAGE_CL,
			"X-YouTube-Page-Label": this.config.PAGE_BUILD_LABEL,
			"X-YouTube-Utc-Offset": String(-new Date().getTimezoneOffset()),
			"X-YouTube-Time-Zone": new Intl.DateTimeFormat().resolvedOptions().timeZone,
		}

		const searchParams = new URLSearchParams()
		Object.entries({
			...query,
			alt: "json",
			key: this.config.INNERTUBE_API_KEY!,
		}).forEach(([key, value]) => {
			searchParams.append(key, value)
		})

		const res = await this.client.post(
			`youtubei/${this.config.INNERTUBE_API_VERSION}/${endpoint}?${searchParams.toString()}`,
			{
				context: {
					capabilities: {},
					client: {
						clientName: this.config.INNERTUBE_CLIENT_NAME,
						clientVersion: this.config.INNERTUBE_CLIENT_VERSION,
						experimentIds: [],
						experimentsToken: "",
						gl: this.config.GL,
						hl: this.config.HL,
						locationInfo: {
							locationPermissionAuthorizationStatus:
								"LOCATION_PERMISSION_AUTHORIZATION_STATUS_UNSUPPORTED",
						},
						musicAppInfo: {
							musicActivityMasterSwitch: "MUSIC_ACTIVITY_MASTER_SWITCH_INDETERMINATE",
							musicLocationMasterSwitch: "MUSIC_LOCATION_MASTER_SWITCH_INDETERMINATE",
							pwaInstallabilityStatus: "PWA_INSTALLABILITY_STATUS_UNKNOWN",
						},
						utcOffsetMinutes: -new Date().getTimezoneOffset(),
					},
					request: {
						internalExperimentFlags: [
							{
								key: "force_music_enable_outertube_tastebuilder_browse",
								value: "true",
							},
							{
								key: "force_music_enable_outertube_playlist_detail_browse",
								value: "true",
							},
							{
								key: "force_music_enable_outertube_search_suggestions",
								value: "true",
							},
						],
						sessionIndex: {},
					},
					user: {
						enableSafetyMode: false,
					},
				},
				...body,
			},
			{
				responseType: "json",
				headers,
			},
		)

		return "responseContext" in res.data ? res.data : res
	}

	/**
	 * Get a list of search suggestiong based on the query
	 *
	 * @param query Query string
	 * @returns Search suggestions
	 */
	public async getSearchSuggestions(query: string): Promise<string[]> {
		return traverseList(
			await this.constructRequest("music/get_search_suggestions", {
				input: query,
			}),
			"query",
		)
	}

	/**
	 * Searches YouTube Music API for results
	 *
	 * @param query Query string
	 */
	public async search(query: string): Promise<SearchResult[]> {
		const searchData = await this.constructRequest("search", {
			query,
			params: null,
		})

		return traverseList(searchData, "musicResponsiveListItemRenderer")
			.map(SearchParser.parse)
			.filter(Boolean) as SearchResult[]
	}

	/**
	 * Searches YouTube Music API for songs
	 *
	 * @param query Query string
	 */
	public async searchSongs(query: string): Promise<SongDetailed[]> {
		const searchData = await this.constructRequest("search", {
			query,
			params: "Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D",
		})

		return traverseList(searchData, "musicResponsiveListItemRenderer").map(
			SongParser.parseSearchResult,
		)
	}

	/**
	 * Searches YouTube Music API for videos
	 *
	 * @param query Query string
	 */
	public async searchVideos(query: string): Promise<VideoDetailed[]> {
		const searchData = await this.constructRequest("search", {
			query,
			params: "Eg-KAQwIABABGAAgACgAMABqChAEEAMQCRAFEAo%3D",
		})

		return traverseList(searchData, "musicResponsiveListItemRenderer").map(
			VideoParser.parseSearchResult,
		)
	}

	/**
	 * Searches YouTube Music API for artists
	 *
	 * @param query Query string
	 */
	public async searchArtists(query: string): Promise<ArtistDetailed[]> {
		const searchData = await this.constructRequest("search", {
			query,
			params: "Eg-KAQwIABAAGAAgASgAMABqChAEEAMQCRAFEAo%3D",
		})

		return traverseList(searchData, "musicResponsiveListItemRenderer").map(
			ArtistParser.parseSearchResult,
		)
	}

	/**
	 * Searches YouTube Music API for albums
	 *
	 * @param query Query string
	 */
	public async searchAlbums(query: string): Promise<AlbumDetailed[]> {
		const searchData = await this.constructRequest("search", {
			query,
			params: "Eg-KAQwIABAAGAEgACgAMABqChAEEAMQCRAFEAo%3D",
		})

		return traverseList(searchData, "musicResponsiveListItemRenderer").map(
			AlbumParser.parseSearchResult,
		)
	}

	/**
	 * Searches YouTube Music API for playlists
	 *
	 * @param query Query string
	 */
	public async searchPlaylists(query: string): Promise<PlaylistDetailed[]> {
		const searchData = await this.constructRequest("search", {
			query,
			params: "Eg-KAQwIABAAGAAgACgBMABqChAEEAMQCRAFEAo%3D",
		})

		return traverseList(searchData, "musicResponsiveListItemRenderer").map(
			PlaylistParser.parseSearchResult,
		)
	}

	private async withRetry<T>(fn: () => Promise<T>, attempts: number = 3): Promise<T> {
		let lastError: Error | null = null

		for (let i = 0; i < attempts; i++) {
			try {
				const result = await fn()
				// Vérifier si le résultat est valide avant de le retourner
				if (result === null || result === undefined) {
					throw new Error("Null or undefined result received")
				}
				return result
			} catch (error) {
				lastError = error as Error
				console.warn(`Attempt ${i + 1}/${attempts} failed: ${lastError.message}`)
				if (i < attempts - 1) {
					const delay = Math.min(Math.pow(2, i) * 1000, 10000) // Max 10 secondes de délai
					await new Promise(resolve => setTimeout(resolve, delay))
				}
			}
		}

		throw lastError
	}

	/**
	 * Get all possible information of a Song
	 *
	 * @param videoId Video ID
	 * @returns Song Data
	 */
	public async getSong(videoId: string): Promise<SongFull> {
		if (!videoId.match(/^[a-zA-Z0-9-_]{11}$/)) throw new Error("Invalid videoId")

		return this.withRetry(async () => {
			try {
				// Première tentative avec l'endpoint "player"
				const data = await this.constructRequest("player", { videoId })

				if (!data || typeof data !== "object") {
					throw new Error("Invalid response from YouTube Music API")
				}

				if ("error" in data) {
					// Si l'erreur indique que la vidéo n'est pas disponible, essayons une autre approche
					if ((data as any).error?.message?.includes("Video unavailable")) {
						// Essayer d'obtenir les informations via l'endpoint "next"
						const nextData = await this.constructRequest("next", {
							videoId,
							playlistId: `RDAMVM${videoId}`,
							isAudioOnly: true,
						})

						if (!nextData || typeof nextData !== "object") {
							throw new Error("Invalid response from next endpoint")
						}

						// Extraire les informations de base de la chanson depuis nextData
						const songInfo =
							nextData?.contents?.singleColumnMusicWatchNextResultsRenderer
								?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs[0]
								?.tabRenderer?.content?.musicQueueRenderer?.content
								?.playlistPanelRenderer?.contents[0]?.playlistPanelVideoRenderer

						if (!songInfo) {
							throw new Error(
								"Could not find song information in next endpoint response",
							)
						}

						// Construire un objet song minimal
						return SongParser.parse({
							videoDetails: {
								videoId: songInfo.videoId,
								title: songInfo.title?.runs[0]?.text || "",
								author: songInfo.shortBylineText?.runs[0]?.text || "",
								lengthSeconds: songInfo.lengthText?.runs[0]?.text || "",
								thumbnail: songInfo.thumbnail?.thumbnails || [],
							},
						})
					}
					throw new Error(
						`YouTube Music API error: ${(data as any).error?.message || "Unknown error"}`,
					)
				}

				const song = SongParser.parse(data)
				if (!song || song.videoId !== videoId) {
					throw new Error("Invalid song data returned from API")
				}

				return song
			} catch (error) {
				throw new Error(
					`Failed to get song with videoId ${videoId}: ${(error as Error).message}`,
				)
			}
		}, 5)
	}

	/**
	 * Get all possible information of a Up Nexts Song
	 *
	 * @param videoId Video ID
	 * @returns Up Nexts Data
	 */

	async getUpNexts(videoId: string): Promise<UpNextsDetails[]> {
		if (!videoId.match(/^[a-zA-Z0-9-_]{11}$/)) throw new Error("Invalid videoId")

		const data = await this.constructRequest("next", {
			videoId,
			playlistId: `RDAMVM${videoId}`,
			isAudioOnly: true,
		})

		const tabs =
			data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
				?.watchNextTabbedResultsRenderer?.tabs[0]?.tabRenderer?.content?.musicQueueRenderer
				?.content?.playlistPanelRenderer?.contents

		if (!tabs) throw new Error("Invalid response structure")

		return tabs.slice(1).map((item: any) => {
			const { videoId, title, shortBylineText, lengthText, thumbnail } =
				item.playlistPanelVideoRenderer
			return {
				type: "SONG",
				videoId,
				title: title?.runs[0]?.text || "Unknown",
				artists: shortBylineText?.runs[0]?.text || "Unknown",
				duration: lengthText?.runs[0]?.text || "Unknown",
				thumbnail: thumbnail?.thumbnails.at(-1)?.url || "Unknown",
			}
		})
	}

	/**
	 * Get all possible information of a Video
	 *
	 * @param videoId Video ID
	 * @returns Video Data
	 */
	public async getVideo(videoId: string): Promise<VideoFull> {
		if (!videoId.match(/^[a-zA-Z0-9-_]{11}$/)) throw new Error("Invalid videoId")
		const data = await this.constructRequest("player", { videoId })

		const video = VideoParser.parse(data)
		if (video.videoId !== videoId) throw new Error("Invalid videoId")
		return video
	}

	/**
	 * Get lyrics of a specific Song
	 *
	 * @param videoId Video ID
	 * @returns Lyrics
	 */
	public async getLyrics(videoId: string) {
		if (!videoId.match(/^[a-zA-Z0-9-_]{11}$/)) throw new Error("Invalid videoId")
		const data = await this.constructRequest("next", { videoId })
		const browseId = traverse(traverseList(data, "tabs", "tabRenderer")[1], "browseId")

		const lyricsData = await this.constructRequest("browse", { browseId })
		const lyrics = traverseString(lyricsData, "description", "runs", "text")

		return lyrics
			? lyrics
					.replaceAll("\r", "")
					.split("\n")
					.filter(v => !!v)
			: null
	}

	/**
	 * Get all possible information of an Artist
	 *
	 * @param artistId Artist ID
	 * @returns Artist Data
	 */
	public async getArtist(artistId: string): Promise<ArtistFull> {
		const data = await this.constructRequest("browse", {
			browseId: artistId,
		})

		return ArtistParser.parse(data, artistId)
	}

	/**
	 * Get all of Artist's Songs
	 *
	 * @param artistId Artist ID
	 * @returns Artist's Songs
	 */
	public async getArtistSongs(artistId: string): Promise<SongDetailed[]> {
		const artistData = await this.constructRequest("browse", {
			browseId: artistId,
		})
		const browseToken = traverse(artistData, "musicShelfRenderer", "title", "browseId")

		if (browseToken instanceof Array) return []

		const songsData = await this.constructRequest("browse", {
			browseId: browseToken,
		})
		const continueToken = traverse(songsData, "continuation")
		const moreSongsData = await this.constructRequest(
			"browse",
			{},
			{ continuation: continueToken },
		)

		return [
			...traverseList(songsData, "musicResponsiveListItemRenderer"),
			...traverseList(moreSongsData, "musicResponsiveListItemRenderer"),
		].map(s =>
			SongParser.parseArtistSong(s, {
				artistId,
				name: traverseString(artistData, "header", "title", "text"),
			}),
		)
	}

	/**
	 * @deprecated Use getArtistReleases() instead for better error handling and unified release management
	 * Get all of Artist's Albums
	 *
	 * @param artistId Artist ID
	 * @returns Artist's Albums
	 */
	public async getArtistAlbums(artistId: string): Promise<AlbumDetailed[]> {
		console.warn("getArtistAlbums() is deprecated. Use getArtistReleases() instead for better error handling.")
		const releases = await this.getArtistReleases(artistId)
		return releases.albums
	}

	/**
	 * @deprecated Use getArtistReleases() instead for better error handling and unified release management
	 * Get all of Artist's Singles and EPs
	 *
	 * @param artistId Artist ID
	 * @returns Artist's Singles and EPs
	 */
	public async getArtistSingles(artistId: string): Promise<AlbumDetailed[]> {
		console.warn("getArtistSingles() is deprecated. Use getArtistReleases() instead for better error handling.")
		const releases = await this.getArtistReleases(artistId)
		return [...releases.singles, ...releases.eps]
	}

	/**
	 * Get all artist releases (albums, singles, EPs) in one unified method
	 * This method handles the common case where YouTube Music mixes releases
	 * and provides better error handling for missing albumIds
	 *
	 * @param artistId Artist ID
	 * @returns Object containing categorized releases
	 */
	public async getArtistReleases(artistId: string): Promise<ArtistReleases> {
		const artistData = await this.constructRequest("browse", {
			browseId: artistId,
		})

		const artistBasic = {
			artistId,
			name: traverseString(artistData, "header", "title", "text"),
		}

		// Récupérer tous les carousels
		const carousels = traverseList(artistData, "musicCarouselShelfRenderer")

		// Fonction pour traiter un carousel et ses "more" items
		const processCarousel = async (carousel: any): Promise<AlbumDetailed[]> => {
			// Items du carousel principal
			const mainItems = traverseList(carousel, "musicTwoRowItemRenderer")
				.map(item =>
					checkTypeStrict(this.parseReleaseItem(item, artistBasic), AlbumDetailed),
				)
				.filter((item): item is AlbumDetailed => item !== null)
				.filter(
					item =>
						item.artist.artistId === artistId && // Même artiste
						!item.albumId?.startsWith("VL"), // Pas une playlist
				)

			// Vérifier s'il y a un bouton "more"
			const browseBody = traverse(carousel, "moreContentButton", "browseEndpoint")

			if (!browseBody) {
				return mainItems
			}

			// Récupérer les items supplémentaires
			const moreData = await this.constructRequest("browse", browseBody)
			const moreItems = traverseList(moreData, "musicTwoRowItemRenderer")
				.map(item =>
					checkTypeStrict(this.parseReleaseItem(item, artistBasic), AlbumDetailed),
				)
				.filter((item): item is AlbumDetailed => item !== null)
				.filter(
					item =>
						item.artist.artistId === artistId && // Même artiste
						!item.albumId?.startsWith("VL"), // Pas une playlist
				)

			return [...mainItems, ...moreItems]
		}

		// Traiter chaque carousel
		const albums: AlbumDetailed[] = []
		const singles: AlbumDetailed[] = []
		const eps: AlbumDetailed[] = []

		for (const carousel of carousels) {
			const title = traverseString(
				carousel,
				"header",
				"musicCarouselShelfBasicHeaderRenderer",
				"title",
				"text",
			)
			if (!title) continue

			const titleLower = title.toLowerCase()
			const items = await processCarousel(carousel)

			// Classification basée sur le titre du carousel et la heuristique des titres
			if (titleLower === "albums") {
				albums.push(...items)
			} else if (titleLower.includes("singles") || titleLower.includes("ep")) {
				// Classification plus fine basée sur les métadonnées
				for (const item of items) {
					const releaseType = this.classifyRelease(item)
					if (releaseType === "SINGLE") {
						singles.push(item)
					} else if (releaseType === "EP") {
						eps.push(item)
					} else {
						// Fallback vers singles si incertain
						singles.push(item)
					}
				}
			}
		}

		return {
			albums,
			singles,
			eps,
		}
	}

	/**
	 * Parse a release item (album/single/EP) with better error handling
	 */
	private parseReleaseItem(
		item: any,
		artistBasic: { artistId: string; name: string | null },
	): any {
		const albumId = traverseList(item, "browseId").at(-1)

		return {
			type: "ALBUM",
			albumId: albumId || `MISSING_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Fallback ID
			playlistId: traverseString(item, "thumbnailOverlay", "playlistId") || "",
			name: traverseString(item, "title", "text") || "Unknown Release",
			artist: artistBasic,
			year: this.processYear(traverseList(item, "subtitle", "text").at(-1)),
			thumbnails: traverseList(item, "thumbnails") || [],
		}
	}

	/**
	 * Classify a release as ALBUM, SINGLE, or EP based on name and metadata
	 */
	private classifyRelease(release: AlbumDetailed): ReleaseType {
		const name = release.name.toLowerCase()

		// Détection par mots-clés dans le titre
		if (name.includes("single") || name.includes("digital single")) {
			return "SINGLE"
		}

		if (name.includes("ep") || name.includes("mini album")) {
			return "EP"
		}

		// Détection par format du nom (patterns courants K-pop)
		if (name.match(/\d+(st|nd|rd|th)\s+single/i)) {
			return "SINGLE"
		}

		if (name.match(/\d+(st|nd|rd|th)\s+mini\s+album/i)) {
			return "EP"
		}

		// Par défaut, considérer comme un single si incertain
		return "SINGLE"
	}

	/**
	 * Process year string to number (extracted from AlbumParser)
	 */
	private processYear(year: string): number | null {
		return year && year.match(/^\d{4}$/) ? +year : null
	}

	/**
	 * Get all possible information of an Album
	 *
	 * @param albumId Album ID
	 * @returns Album Data
	 */
	public async getAlbum(albumId: string): Promise<AlbumFull> {
		const data = await this.constructRequest("browse", {
			browseId: albumId,
		})

		return AlbumParser.parse(data, albumId)
	}

	/**
	 * Get all possible information of a Playlist except the tracks
	 *
	 * @param playlistId Playlist ID
	 * @returns Playlist Data
	 */
	public async getPlaylist(playlistId: string): Promise<PlaylistFull> {
		if (playlistId.startsWith("PL")) playlistId = "VL" + playlistId
		const data = await this.constructRequest("browse", {
			browseId: playlistId,
		})

		return PlaylistParser.parse(data, playlistId)
	}

	/**
	 * Get all videos in a Playlist
	 *
	 * @param playlistId Playlist ID
	 * @returns Playlist's Videos
	 */
	public async getPlaylistVideos(playlistId: string): Promise<VideoDetailed[]> {
		if (playlistId.startsWith("PL")) playlistId = "VL" + playlistId
		const playlistData = await this.constructRequest("browse", {
			browseId: playlistId,
		})

		const songs = traverseList(
			playlistData,
			"musicPlaylistShelfRenderer",
			"musicResponsiveListItemRenderer",
		)
		let continuation = traverse(playlistData, "continuation")
		// Sometimes it returns array, dunno why
		if (continuation instanceof Array) {
			continuation = continuation[0]
		}

		while (!(continuation instanceof Array)) {
			const songsData = await this.constructRequest("browse", {}, { continuation })
			songs.push(...traverseList(songsData, "musicResponsiveListItemRenderer"))
			continuation = traverse(songsData, "continuation")
		}

		return songs
			.map(VideoParser.parsePlaylistVideo)
			.filter((video): video is VideoDetailed => video !== undefined)
	}

	/**
	 * Get sections for the home page.
	 *
	 * @returns Mixed HomeSection
	 */
	public async getHomeSections(): Promise<HomeSection[]> {
		const data = await this.constructRequest("browse", {
			browseId: FE_MUSIC_HOME,
		})

		const sections = traverseList("sectionListRenderer", "contents")
		let continuation = traverseString(data, "continuation")
		while (continuation) {
			const data = await this.constructRequest("browse", {}, { continuation })
			sections.push(...traverseList(data, "sectionListContinuation", "contents"))
			continuation = traverseString(data, "continuation")
		}

		return sections.map(Parser.parseHomeSection)
	}
}
