# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ytm-api-ts** is a TypeScript library for interfacing with the YouTube Music API. It's a fork of zS1L3NT's project, maintained by zokiasu, providing unofficial access to YouTube Music data with strong TypeScript support.

Key characteristics:
- **API Scraper**: Extracts data directly from YouTube Music's internal API endpoints
- **Type-Safe**: Uses Zod schemas for runtime validation and TypeScript type generation
- **Comprehensive Coverage**: Supports songs, videos, artists, albums, playlists, and lyrics
- **Cookie-Based Authentication**: Uses tough-cookie for session management

## Build System and Commands

**Development Commands:**
```bash
# Build the library (creates dist/ with CJS/ESM outputs)
npm run build

# Lint and format code with Biome + TypeScript check
npm run lint

# Run tests
bun test
```

**Build Tools:**
- **tsup**: Builds both CommonJS and ESM outputs with sourcemaps
- **Biome**: Handles linting and formatting (replaces ESLint/Prettier)
- **TypeScript**: Strict configuration with enhanced type checking
- **Bun**: Used as test runner and package manager

## Architecture

### Core Components

1. **YTMusic Class** (`src/YTMusic.ts`): Main API client
   - Handles initialization and cookie management
   - Constructs authenticated requests to YouTube Music API
   - Provides public methods for all API operations
   - Uses axios with interceptors for cookie handling

2. **Type System** (`src/types.ts`): Zod-based schema definitions
   - Runtime validation with compile-time types
   - Discriminated unions for search results
   - Hierarchical types (Basic → Detailed → Full)

3. **Parser System** (`src/parsers/`): Specialized parsers for different data types
   - `Parser.ts`: Base utilities (duration parsing, number parsing, home sections)
   - Entity-specific parsers: `SongParser`, `VideoParser`, `ArtistParser`, `AlbumParser`, `PlaylistParser`, `SearchParser`
   - Each parser handles both search results and detailed entity data

4. **Utilities** (`src/utils/`):
   - `traverse.ts`: Navigate complex YouTube API response structures
   - `checkType.ts`: Zod schema validation with error handling
   - `filters.ts`: Data filtering utilities

### Request Flow

1. **Initialization**: Client fetches YouTube Music page to extract API configuration
2. **Authentication**: Uses extracted keys and visitor data for API requests
3. **Request Construction**: Builds proper headers and context for YouTube's internal API
4. **Response Parsing**: Traverses complex nested API responses
5. **Type Validation**: Validates and transforms data using Zod schemas

### Data Types Hierarchy

- **Basic**: Minimal info (e.g., `ArtistBasic` with just ID and name)
- **Detailed**: Search result level (adds thumbnails, duration, etc.)
- **Full**: Complete entity data (includes related content, formats, etc.)

## Key Patterns

### Error Handling and Retries
The `getSong` method implements retry logic with exponential backoff for handling YouTube Music API instability.

### API Endpoint Patterns
- Search operations use `search` endpoint with different `params` for filtering
- Entity details use `browse` endpoint with entity-specific `browseId`
- Continuation tokens handle paginated responses

### Parser Architecture
Each parser follows a consistent pattern:
- `parseSearchResult`: For search result items
- `parse`: For full entity data
- `parseArtistSong/Album`: For entity-specific contexts
- `parseHomeSection`: For home page carousel items

## Testing

Tests are located in `src/tests/` and use Bun Test:
- `core.spec.ts`: Core functionality tests
- `home.spec.ts`: Home page API tests

Run tests with `bun test` - this validates that API responses match TypeScript definitions.

## Recent Improvements

### Unified Release Management
- **New method**: `getArtistReleases(artistId)` - Unified method to get all artist releases
- **Better error handling**: `checkTypeStrict()` function filters invalid data instead of crashing
- **Smart classification**: Automatically categorizes releases as albums, singles, or EPs
- **Backward compatibility**: Existing `getArtistAlbums()` and `getArtistSingles()` methods remain unchanged

### Error Handling Strategy
The API now handles YouTube Music's inconsistent data better:
- Missing `albumId` fields get fallback IDs
- Invalid releases are filtered out rather than causing validation errors
- Warning logs instead of error logs for data issues

## Code Style

The project uses Biome with strict configuration:
- Tab indentation (width: 4)
- 100 character line width
- Trailing commas required
- Semi-colons as needed
- Double quotes for strings

TypeScript configuration is strict with enhanced checking enabled (strictNullChecks, noUncheckedIndexedAccess, etc.).