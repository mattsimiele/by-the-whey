alter table public.cheeses
add column if not exists catalog_category text;

alter table public.cheeses
drop constraint if exists cheeses_catalog_category_check;

alter table public.cheeses
add constraint cheeses_catalog_category_check check (
  catalog_category is null or catalog_category in (
    'Alpine', 'Blue Cheese', 'Cheddar', 'Fresh Cheese', 'Gouda',
    'Hard Aged Cheese', 'Soft Cheese', 'Tomme Style', 'Washed Rind'
  )
);

update public.cheeses set catalog_category = 'Washed Rind' where slug = any(array[
  'afterglow', 'barista', 'cabricafe', 'langres-pronounced-long-wruh', 'le-bruzy', 'mild-brick', 'munster',
  'nabbabo', 'oma', 'opa', 'pawlet', 'smorbier', 'winnimere'
]);
update public.cheeses set catalog_category = 'Tomme Style' where slug = any(array[
  'appalachian', 'coppinger', 'drunken-goat', 'goliath', 'the-gray', 'la-dama-sagrada', 'manchego-semi-curado',
  'riley-s-2x4', 'tomarashi', 'wilde-goat'
]);
update public.cheeses set catalog_category = 'Soft Cheese' where slug = any(array[
  'adiron-jack', 'bonde-d-antan', 'brebirousse-d-argental', 'brie-fermier', 'brie-paysan', 'camembert-reo',
  'camembertha', 'ca-a-de-cabra', 'cremeux-de-bourgogne', 'delice-de-bourgogne', 'harbison', 'kunik',
  'moses-sleeper', 'mt-alice', 'nancy-s-camembert', 'perail', 'piper-s-pyramide', 'prix-de-diane',
  'robiola-bosina', 'shabby-shoe', 'sofia', 'tomme-1947', 'wabash-cannonball'
]);
update public.cheeses set catalog_category = 'Hard Aged Cheese' where slug = any(array[
  'bella-bantam', 'cravero-parmigiano-reggiano', 'fulvi-pecorino-romano', 'mariana', 'ragusano', 'sierra-la-solana'
]);
update public.cheeses set catalog_category = 'Gouda' where slug = any(array[
  'brabander', 'buffelkaas-buffalo-gouda', 'double-dutch', 'finger-lakes-gold', 'hootenanny',
  'jake-s-aged-gouda', 'jake-s-baby-gouda', 'jake-s-smoked-gouda', 'natty-gouda', 'old-farmdal',
  'stompetoren-grand-cru'
]);
update public.cheeses set catalog_category = 'Fresh Cheese' where slug = any(array[
  'feta-voras', 'lesbos-feta', 'meredith-dairy-goat-and-sheep', 'o-banon', 'sach-paneer', 'saltbush-chevre', 'wooly-wooly'
]);
update public.cheeses set catalog_category = 'Cheddar' where slug = any(array[
  'shelburne-2-year', 'cabot-clothbound-cheddar', 'jake-s-3-year-cheddar', 'peak-s-cheddar',
  'maple-smoked-cheddar', 'red-butte-hatch-chile-cheddar', 'street-ched', 'widmer-s-2-year'
]);
update public.cheeses set catalog_category = 'Blue Cheese' where slug = any(array[
  'ba-ba-blue', 'bayley-hazen', 'cascadilla-blue', 'cayuga-blue', 'fennel-blue', 'fourme-d-ambert',
  'gorgonzola-dolce', 'high-lawn-blue', 'penta-creme-blue', 'negroni-blue', 'red-rock', 'rogue-river-blue',
  'shakerag-blue', 'stilton-pdo', 'stichelton'
]);
update public.cheeses set catalog_category = 'Alpine' where slug = any(array[
  'alfred-le-fermier', 'alp-blossom', 'alpha-tolman', 'ashbrook', 'challerhocker', 'cyclamen-comte',
  'fontina-valle-d-aosta', 'gruyere-surchoix-surchoix-means-first-choice-or-top-quality', 'hornbacher',
  'le-cousin', 'l-etivaz', 'mountaineer', 'pleasant-ridge-reserve',
  'raclette-livradois-pronounced-leev-wa-dwa', 'raclette-livradois-with-ramps', 'raclette-de-savoie',
  'rahmtaler-reserve', 'rupert', 'silver-lake', 'almn-s-tegel', 't-te-de-moine', 'underpass', 'whitney'
]);

create index if not exists cheeses_catalog_category_idx
on public.cheeses (catalog_category, name)
where status = 'published';
