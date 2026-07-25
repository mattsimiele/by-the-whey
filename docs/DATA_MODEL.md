# Production data model

## Core tables

### profiles

- `id` — references the authenticated user
- `handle`, `display_name`, `bio`, `avatar_path`, `location`
- `role` — `turophile`, `cheesemonger`, or `admin`
- `role_status` — pending, approved, suspended
- timestamps

### cheeses

- `id`, `slug`, `name`
- `creamery_id`, `creamery_name`
- `location_city`, `location_region`, `location_country`
- `milk_type` — required display value such as “raw cow’s milk”
- `rennet` — required; animal, microbial, vegetable, thistle, mixed, or unknown
- `cheese_style`
- `age_description` — required; use “fresh/unaged” when aging does not apply
- `flavor_profile` — required structured list of flavor descriptors
- `story_notes` — required producer, process, history, and distinguishing details
- `pairings` — required structured list of suitable foods and beverages
- `image_path`
- `status` — draft, pending, published, rejected
- `submitted_by`, `approved_by`
- timestamps

All catalog information above is required before publication. If a fact cannot be confirmed, it must be explicitly stored as `unknown` or `not provided by creamery`, rather than silently omitted. Admins may return an incomplete submission to the cheesemonger for revision.

## Canonical cheese example

### Shelburne 2 Year

- **Cheese name:** Shelburne 2 Year
- **Creamery:** Shelburne Farms
- **Location:** Shelburne, Vermont
- **Milk type:** Raw cow’s milk
- **Rennet:** Animal
- **Cheese style:** Cheddar
- **Age:** Minimum two years
- **Flavor profile:** Brothy, caramelized onions, and toasted nuts
- **Story / notes:** Uses a pasture-raised Brown Swiss herd and is processed by hand. A classic Vermont-style cheddar.
- **Pairings:** Granny Smith apples, crisp pears, raw honey, fig spread, sourdough bread; Cabernet Sauvignon or Merlot; oaked Chardonnay or dry Riesling

### tastings

- `id`, `user_id`, `cheese_id`
- `rating` — decimal from 0.5 to 5.0
- `notes`, `location_name`, `visibility`
- timestamps

### tasting_photos

- `id`, `tasting_id`, `storage_path`, `sort_order`

### follows

- composite key: `follower_id`, `following_id`

### likes

- composite key: `user_id`, `tasting_id`

### comments

- `id`, `tasting_id`, `user_id`, `body`, timestamps

### cheese_lists

- `id`, `user_id`, `name`, `is_default`

### cheese_list_items

- composite key: `list_id`, `cheese_id`

### reports

- `id`, `reporter_id`, `target_type`, `target_id`, `reason`
- `status`, `reviewed_by`, timestamps

## Permission model

- Everyone may read published cheeses.
- Signed-in users may update only their own profile and social content.
- Turophiles may create tastings only against published catalog entries.
- Approved cheesemongers may create pending cheese submissions and update only their pending or rejected submissions.
- Admin actions should be performed through verified server-side role checks.
- Storage rules should mirror database ownership and visibility.
- Role changes must never be writable by the user receiving the role.

## Feed query

The initial feed combines public tastings by followed profiles, ordered by recency, with a separate discovery section for community trending content. Denormalized counters or database functions can be introduced only after real usage demonstrates a need.
