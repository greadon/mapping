# StageMode Mapping

Standalone rally route designer, version 0.3.1. Plan ordered special stages and liaison sections, route along roads, and place controls and numbered junctions. StageMode provides the stage identities and marshal references through its existing HTTP API.

GitHub repository: https://github.com/greadon/stageplan

## Live snapping fix (0.3.1)

Road snapping now updates automatically when waypoints are added, dragged, removed, or undone. Rapid edits supersede older requests. Finish saves the exact accepted preview without requesting another road route; it is disabled until the current preview is ready. On failure your waypoints stay editable, the previous route is shown faded and dashed, and **Retry snapping** appears. Cancel aborts pending work. Manual mode stays available.

## Rally planning additions (0.3)

- Choose **Draw route**, click waypoints on the intended roads, and road geometry updates automatically as you draw. Choose **Finish route** to save the preview. **Snap to roads** is the default for new routes; **Manual / tracks** draws straight lines for unmapped or restricted tracks. Editing retains the original waypoints separately from calculated geometry. Routing failures retain your edit without silently substituting straight lines.
- Road routing uses the OSRM driving profile through a server endpoint, with a maximum of 100 waypoints per section and a 20-second timeout. It follows the routing service's road access and direction rules; closed-road rally use may require manual geometry. Click additional waypoints to constrain the intended route. Road snapping updates after each waypoint change; Finish uses the completed preview.
- The prototype defaults to the public OSRM demonstration service. Set `ROUTING_URL` to an appropriate OSRM server origin for operational use. Waypoint coordinates are sent to that service; StageMode credentials and marshal information are not sent.
- Set each section to **Special stage** or **Liaison** in the inspector. Liaisons use an amber dashed route. Local sections can be added, renamed and deleted. **Delete section** is available only in Edit section mode and removes the local section with its route, controls and junctions; **Undo** restores the last saved section during the session. Deleting the last section leaves an empty map; **+ Add section** starts another. Deleted sections stay deleted after reopening. Connected StageMode stages remain read-only. Enable **Show full rally route** for context.
- To split a local section, choose **Edit section**, select an interior numbered waypoint, and choose **Split section here**. Both resulting sections share a boundary on the existing route geometry; splitting does not issue another routing request. The new section gets the opposite section type. Existing controls and junctions remain in the first section for review; reassignment is manual. Splitting connected StageMode stages is not supported because new identities require changes in Control.
- Controls include Time control, Start, Arrival, Flying finish and Stop. Junctions have editable positive numbers displayed on the map.
- **Export map** remains the round-trip JSON backup. **Export rally GIS** creates GeoJSON with ordered section IDs/types, road geometry, distances in kilometres, control types, junction numbers, coordinates and optional StageMode location links. It excludes marshal names and allocations. A StageMode importer for this exchange format is not yet implemented. Existing version-1 map files remain readable with default stage/manual settings.

## Start locally

Requires Node 22.9 or later. No package installation is needed.

```powershell
cd C:\Users\GeorgeEadon\Documents\Codex\StageMode\mapping
npm start
```

Open http://127.0.0.1:8091. Sign in to use StageMode stages, choose **Start a map without signing in** for local stage drafts, or explore the fictional demonstration. The local `.env` targets `https://control.stagemode.io`; the gateway appends the `/api` paths. Copy `.env.example` to `.env` when setting up a new copy.

To start the server in the background or restart it if it is already running, use `.\scripts\Restart-LocalServer.ps1` from the project folder. The script uses the `PORT` in `.env` (or `8091` by default) and writes output to `scripts\server.stdout.log` and `scripts\server.stderr.log`.

## Stage authoring

The map fills the window with compact floating icon tools. Hover over a tool for its name. The upper-left menu contains event selection, Import map, Export rally GIS, Export map, Save draft, Refresh StageMode and Close map / Sign out. Close the menu with its close button, Escape, or a click outside it.

The upper-left itinerary icon toggles the section list. Drag a section by its grip to reorder it, or focus the grip and use Up/Down arrows. The order is saved in the map draft and GIS export, with Undo available. A separate Key button opens visibility switches for routes, controls, junctions and marshals; each itinerary row also toggles its entire section. Click a section or route to open its details. Each panel also has a close button. Panel preferences are remembered in this browser. Selecting a waypoint, control or junction opens its details. On narrow screens, only one sidebar is shown at a time.

With **Select / move**, click a route to select its section and open route properties, with **Section Type** first, followed by length and junction count. Routes also support keyboard focus and Enter/Space activation. Section Type is read-only until **Edit section** is active. Changes to its value are saved with Finish route and discarded with Cancel edit. The name is also editable in Edit section mode. Save commits the name, type and route together; Cancel discards the pending changes. The properties panel provides **Edit section** and the section settings. Sidebars and the main menu have translucent backgrounds so the map remains visible beneath them.

1. Choose the event and stage. Only the selected stage appears by default; **Show other stages for context** displays the other enabled stage groups.
2. Choose **Draw route** and click waypoints along the road. Road snapping updates as you add or drag waypoints. **Finish route** commits the displayed route, or straight lines in Manual mode. **Edit section** exposes draggable waypoints and allows more points to be appended. Select a waypoint to remove it. **Cancel edit** or Escape restores the previous route.
3. Choose **Add control**, select its type (Control, Time control, Start, Flying finish or Stop), then click the map. **Add junction** places a junction instead.
4. Select a placeholder to edit its name, coordinates, notes and optional StageMode location link. Click **Apply changes** to commit form edits. Drag markers with **Select / move** to reposition them. Removing a route leaves its placeholders intact.
5. Use the **Key** widget to show or hide **Routes**, **Controls**, **Junctions**, and **Marshals** across the map. Use each itinerary row checkbox to show or hide its whole section. Visibility settings are saved in the draft. Reordering connected StageMode sections changes only this mapping draft.
6. **Undo** and **Redo** restore committed changes during the current editing session. While drawing, Undo removes the latest route point. Finish or cancel a route before switching stages or importing a file.

Local maps support adding and renaming stages. Stage identities imported from Control are kept as supplied by Control.

## Marshal layer

Marshal badges show allocations at StageMode locations. Link a control or junction placeholder to a location to place that location's marshal badge at the placeholder's position. Each location can be linked to only one placeholder within a stage; linked runs remain independent stages.

Select a badge or use the location/marshal lookup to see role requirements, allocated people, call signs and sign-on status. Requirements are counted per role, with duplicates removed and pending invitations excluded. A surplus in one role cannot cover a different role's shortage. Unspecified requirements are distinguished from requirements met. Locations without coordinates remain accessible through lookup and can be positioned by linking a placeholder. People without a location allocation cannot be plotted.

Use **Refresh StageMode** to reload references. Reference data is manually refreshed, not a live tracking feed. Unavailable stages are reported instead of being treated as having no requirements.

## Saving and portability

Committed drawings auto-save to browser local storage, scoped by Control origin, account and event. Demo and local maps use separate draft spaces. **Save draft** also explicitly saves. Drafts stay in this browser profile and are not uploaded to Control or shared with other devices. Clearing browser storage removes them.

**Export map** downloads a JSON map file containing stage routes, control/junction placeholders, their location IDs, notes and layer settings. Marshal names and allocations are never included. **Import map** validates the format, event identity, coordinates, stage IDs and duplicate location links before replacing the corresponding stage drawings. Unknown stages are rejected for connected events. Local maps can import local stage groups. Import can be undone during the same editing session. Keep exported copies for backup or moving a draft to another browser.

Drafts are not an offline basemap feature: background map tiles, Leaflet and road routing need an internet connection. GPX import/export, central draft storage, collaborative editing and writing controls back to StageMode are not implemented in this version.

## API connection and permissions

The gateway connects to one configured Control origin. It has no database connection. Upstream session cookies remain in server memory and the browser receives an independent HttpOnly cookie. Restarting the mapping server requires users to sign in again, while saved map drafts remain in the browser. Control enforces event and stage permissions on every API request.

| Control API | Use |
| --- | --- |
| `POST /api/auth/login`, `POST /api/auth/logout` | Sign in/out |
| `GET /api/auth/me` | Check session |
| `GET /api/events` | Accessible events |
| `GET /api/events/{id}?view=marshals` | Stages and marshal allocations |
| `GET /api/events/{id}/stages/{stageId}/locations` | Coordinates and role requirements |

This connection uses the web-session API, not a mobile bearer token or integration API key. It requires access to the Marshals view and stage locations. The gateway exposes no Control editing operations. The existing locations GET handler inside Control can initialise missing Start/Stop locations; this project does not change that behaviour or require migrations.

The configured API has returned the expected HTTP 401 for an unauthenticated session check. An authenticated live event test is still outstanding.

## Verification and deployment

Run `npm test`. Tests cover stage-scoped draft round trips, malformed import rejection, undo/redo, role-specific staffing coverage, linked marshal positioning, route distance, coordinate validation, gateway sessions, origin enforcement, endpoint restrictions and omission of unnecessary personal fields. Browser checks exercised drawing and finishing a route, adding a control and junction, linking a control to a StageMode location, separate layer switches, stage switching, and reopening saved drafts.

Leaflet 1.9.4 follows the [official API reference](https://leafletjs.com/reference.html). Background maps use OpenStreetMap with visible attribution and normal browser caching. Review the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before operational deployment; the standard tile service is best effort. No map prefetching is performed.

For remote use, configure an HTTPS Control origin, place Mapping behind HTTPS and set `PUBLIC_ORIGIN` to the exact public origin. Keep its listening port private behind the proxy. The default listener is loopback-only. Add deployment-specific monitoring and authentication rate limits at the proxy. This application has not been deployed.

`nLegs: use **+ Add leg** in the itinerary, rename the leg in its heading, and choose its route colour. Assign sections using their leg selector, or drag beside a section in the destination leg. All sections in a leg share its route colour; liaison lines retain their dashed style. Remove is available only for empty legs. Assignments, colours and order save with the map, support Undo, and appear in GIS exports.
Optional what3words: set WHAT3WORDS_API_KEY in the local .env file and restart the mapping server. Marker details then resolve English what3words addresses below longitude and latitude. The key stays on the server; only the selected marker coordinates are sent to the what3words API. Addresses refresh when markers move.
