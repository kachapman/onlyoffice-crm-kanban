/**
 * Vanguard CRM — multi-group opportunity board (local test portal)
 */

const DEFAULT_PORTAL = "https://office.vanguardadj.com";
const GROUPS_STORAGE_KEY = "oo_board_groups_v2";
const CALENDARS_STORAGE_KEY = "oo_board_calendars_v1";
const NOTES_TILES_STORAGE_KEY = "oo_board_notes_v1";
const LOCAL_KANBAN_TILES_STORAGE_KEY = "oo_board_local_kanban_v1";
const LAYOUT_STORAGE_KEY = "oo_board_layout_v2";
const HIDDEN_FEED_STORAGE_KEY = "oo_board_hidden_feed_v1";
const FEED_KEYWORD_STORAGE_KEY = "oo_board_feed_keyword_v1";
const GROUP_TEMPLATES_STORAGE_KEY = "oo_board_group_templates_v1";
const BOOKMARKED_STORAGE_KEY = "oo_board_bookmarked_v1";
const MAX_BOOKMARKED_DEALS = 15;
const FEED_DAYS = 30;
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_MAX_EVENTS = 150;
const FEED_HISTORY_PAGE_SIZE = 100;
const FEED_MAIL_SEARCH = "CRM. New event added to";
const FEED_MAIL_SEARCHES = [FEED_MAIL_SEARCH, "CRM New event added to"];
const FEED_MAIL_PAGE_SIZE = 60;
const FEED_INITIAL_HISTORY_PAGES = 3;
const FEED_INITIAL_MAIL_PAGES = 2;
const OPP_CUSTOM_FIELD_ENRICH_CONCURRENCY = 5;
const HIDDEN_FEED_RETENTION_DAYS = 30;
const HIDDEN_FEED_RETENTION_MS = HIDDEN_FEED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PANEL_TILE_AUTO_REFRESH_MS = 60 * 60 * 1000;
const DASHBOARD_IDLE_STOP_MS = 3 * 60 * 60 * 1000;
const OPP_TAG_CACHE_TTL_MS = 5 * 60 * 1000;
const OPP_CUSTOM_FIELD_CACHE_TTL_MS = 5 * 60 * 1000;
const FILTER_RESULT_CACHE_TTL_MS = 30 * 1000;
/** Set true when create-opportunity custom user field save is fixed (see ISSUES.md). */
const CREATE_OPP_USER_FIELDS_ENABLED = true;

/** Mutation queue for offline / transient CRM write resilience (client-side only). Completed. */
const MUTATION_QUEUE_KEY = "oo_board_mutation_queue_v1";
const TASK_CATEGORIES_KEY = "oo_board_task_categories_v1";
const MAX_QUEUE_SIZE = 50;
const RETRY_INTERVAL_MS = 5000;

/** Presence / Team feature (user status, online list, basic DMs, pinned top tile) */
const PRESENCE_USERS_CACHE_KEY = "oo_board_presence_users_v1";
const PRESENCE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // refresh on next login or after ~7 days
const PRESENCE_POLL_MS = 30000; // when modal or visible tile is active
const PRESENCE_HEARTBEAT_VISIBLE_MS = 30000; // 30s when tab visible
const PRESENCE_HEARTBEAT_BG_MS = 120000; // 2min when backgrounded (via sendBeacon)
const PRESENCE_IDLE_2H_MS = 2 * 60 * 60 * 1000;
const PRESENCE_AUTO_LOGOUT_3H_MS = 3 * 60 * 60 * 1000;
const PRESENCE_CUSTOM_MAX = 120; // modest char limit for custom status (emojis allowed)
const PRESENCE_IDLE_15M_MS = 15 * 60 * 1000; // auto-derived idle threshold
const PRESENCE_AUTO_STATUS_TIMEOUT_MS = 300000; // 5 min — clear auto-status if no new deal activity

/** Daily Focus quote — rotating daily inspiration banner */
const DAILY_FOCUS_KEY = "oo_daily_focus_author";
const DAILY_FOCUS_RANDOM_KEY = "oo_daily_focus_random";
const DAILY_QUOTES = [
  // Dune (30)
  { text: "Fear is the mind-killer.", author: "Frank Herbert" },
  { text: "I must not fear. I will face my fear and let it pass through me.", author: "Frank Herbert" },
  { text: "The mystery of life isn't a problem to solve, but a reality to experience.", author: "Frank Herbert" },
  { text: "A process cannot be understood by stopping it.", author: "Frank Herbert" },
  { text: "He who controls the spice controls the universe.", author: "Frank Herbert" },
  { text: "Without change, something sleeps inside us, and seldom awakens.", author: "Frank Herbert" },
  { text: "There is no escape—we pay for the violence of our ancestors.", author: "Frank Herbert" },
  { text: "The mind can make a heaven of hell, or a hell of heaven.", author: "Frank Herbert" },
  { text: "Survival is the ability to swim in strange water.", author: "Frank Herbert" },
  { text: "What do you despise? By this you are truly known.", author: "Frank Herbert" },
  { text: "Wealth is a tool of freedom, but the pursuit of wealth is the road to slavery.", author: "Frank Herbert" },
  { text: "The beginning of knowledge is the discovery of something we do not understand.", author: "Frank Herbert" },
  { text: "The people who can destroy a thing, they control it.", author: "Frank Herbert" },
  { text: "Deep in the human unconscious is a pervasive need for a logical universe.", author: "Frank Herbert" },
  { text: "Do not be deceived by the fact that you are used to something.", author: "Frank Herbert" },
  { text: "Humans are born with a desire to control their environment.", author: "Frank Herbert" },
  { text: "The highest function of ecology is understanding consequences.", author: "Frank Herbert" },
  { text: "The power to destroy a thing is the absolute control over it.", author: "Frank Herbert" },
  { text: "Hope clouds observation.", author: "Frank Herbert" },
  { text: "The thing we call technology is the art of arranging life so you don't have to work.", author: "Frank Herbert" },
  { text: "There is no real ending. It's just the place where you stop the story.", author: "Frank Herbert" },
  { text: "The gift of words is the gift of deception.", author: "Frank Herbert" },
  { text: "You cannot back into the future.", author: "Frank Herbert" },
  { text: "A man is a fool not to put everything he has into whatever he is doing.", author: "Frank Herbert" },
  { text: "The most persistent principles of the universe are accident and error.", author: "Frank Herbert" },
  { text: "To attempt an understanding of the Creator is to attempt the impossible.", author: "Frank Herbert" },
  { text: "I must not fear. Fear is the little-death.", author: "Frank Herbert" },
  { text: "The people who are the most dangerous are those who think they are doing right.", author: "Frank Herbert" },
  { text: "The only lasting truth is Change.", author: "Frank Herbert" },
  { text: "God is not separate from the universe; He is the universe.", author: "Frank Herbert" },
  // Tolkien (30)
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "Even the smallest person can change the course of the future.", author: "J.R.R. Tolkien" },
  { text: "There is some good in this world, and it's worth fighting for.", author: "J.R.R. Tolkien" },
  { text: "All we have to decide is what to do with the time that is given us.", author: "J.R.R. Tolkien" },
  { text: "The road goes ever on and on.", author: "J.R.R. Tolkien" },
  { text: "A single dream is more powerful than a thousand realities.", author: "J.R.R. Tolkien" },
  { text: "Courage is found in unlikely places.", author: "J.R.R. Tolkien" },
  { text: "If more of us valued food and cheer above hoarded gold, it would be a merrier world.", author: "J.R.R. Tolkien" },
  { text: "I will not say: do not weep; for not all tears are an evil.", author: "J.R.R. Tolkien" },
  { text: "It's a dangerous business going out your door.", author: "J.R.R. Tolkien" },
  { text: "Faithless is he that says farewell when the road darkens.", author: "J.R.R. Tolkien" },
  { text: "The world is indeed full of peril, but still there is much that is fair.", author: "J.R.R. Tolkien" },
  { text: "A man that flies from his fear may find that he has only taken a shortcut to meet it.", author: "J.R.R. Tolkien" },
  { text: "I would rather spend one lifetime with you than face all the ages of this world alone.", author: "J.R.R. Tolkien" },
  { text: "The leaves were long, the grass was green, the hemlock-umbels tall and fair.", author: "J.R.R. Tolkien" },
  { text: "I have claimed that Escape is one of the main functions of fairy-stories.", author: "J.R.R. Tolkien" },
  { text: "It is not the strength of the body, but the will of the heart that matters.", author: "J.R.R. Tolkien" },
  { text: "Short cuts make long delays.", author: "J.R.R. Tolkien" },
  { text: "There is nothing like looking, if you want to find something.", author: "J.R.R. Tolkien" },
  { text: "Do not meddle in the affairs of wizards, for they are subtle and quick to anger.", author: "J.R.R. Tolkien" },
  { text: "The wise speak only of what they know.", author: "J.R.R. Tolkien" },
  { text: "Many that live deserve death. And some that die deserve life.", author: "J.R.R. Tolkien" },
  { text: "Oft hope is born when all is forlorn.", author: "J.R.R. Tolkien" },
  { text: "The darkness is passing, but the light has not yet come.", author: "J.R.R. Tolkien" },
  { text: "It is a strange thing to be so spoken of by a dragon.", author: "J.R.R. Tolkien" },
  { text: "The greatest adventure is what lies ahead.", author: "J.R.R. Tolkien" },
  { text: "May the wind under your wings bear you where the sun sails and the moon walks.", author: "J.R.R. Tolkien" },
  { text: "Laughter is the music of the heart, the voice of the soul.", author: "J.R.R. Tolkien" },
  { text: "The old that is strong does not wither, deep roots are not reached by the frost.", author: "J.R.R. Tolkien" },
  // Chesterton (30)
  { text: "Fairy tales are more than true: not because they tell us dragons exist, but because they tell us dragons can be beaten.", author: "G.K. Chesterton" },
  { text: "An adventure is only an inconvenience rightly considered.", author: "G.K. Chesterton" },
  { text: "The true soldier fights because he loves what is behind him.", author: "G.K. Chesterton" },
  { text: "There are no uninteresting things, only uninterested people.", author: "G.K. Chesterton" },
  { text: "The Christian ideal has not been tried and found wanting. It has been found difficult; and left untried.", author: "G.K. Chesterton" },
  { text: "A good novel tells us the truth about its hero; but a bad novel tells us the truth about its author.", author: "G.K. Chesterton" },
  { text: "The traveller sees what he sees. The tourist sees what he has come to see.", author: "G.K. Chesterton" },
  { text: "When men choose not to believe in God, they become capable of believing in anything.", author: "G.K. Chesterton" },
  { text: "Art, like morality, consists of drawing the line somewhere.", author: "G.K. Chesterton" },
  { text: "Courage is a strong desire to live taking the form of a readiness to die.", author: "G.K. Chesterton" },
  { text: "The most extraordinary thing is an ordinary man and an ordinary woman and their ordinary children.", author: "G.K. Chesterton" },
  { text: "Fallacies do not cease to be fallacies because they become fashions.", author: "G.K. Chesterton" },
  { text: "The way to love anything is to realize that it may be lost.", author: "G.K. Chesterton" },
  { text: "A dead thing can go with the stream, but only a living thing can go against it.", author: "G.K. Chesterton" },
  { text: "The whole object of travel is not to set foot on foreign land; it is to set foot on one's own country.", author: "G.K. Chesterton" },
  { text: "There are two ways to get enough: one is to continue to accumulate more and more. The other is to desire less.", author: "G.K. Chesterton" },
  { text: "Education is simply the soul of a society as it passes from one generation to another.", author: "G.K. Chesterton" },
  { text: "The poet only asks to get his head into the heavens. The logician seeks to get the heavens into his head.", author: "G.K. Chesterton" },
  { text: "Angels can fly because they can take themselves lightly.", author: "G.K. Chesterton" },
  { text: "The man who never alters his opinion is like standing water, and breeds reptiles of the mind.", author: "G.K. Chesterton" },
  { text: "To have a right to do a thing is not at all the same as to be right in doing it.", author: "G.K. Chesterton" },
  { text: "The purpose of an open mind is to close it on something solid.", author: "G.K. Chesterton" },
  { text: "I owe my success to having listened respectfully to the very best advice.", author: "G.K. Chesterton" },
  { text: "The Bible tells us to love our neighbors, and also to love our enemies.", author: "G.K. Chesterton" },
  { text: "The truth is, of course, that the rich are the only people who can afford to be poor.", author: "G.K. Chesterton" },
  { text: "A yawn is a silent shout.", author: "G.K. Chesterton" },
  { text: "The first effect of not believing in God is to believe in anything.", author: "G.K. Chesterton" },
  { text: "The shortest way to do many things is to do only one thing at a time.", author: "G.K. Chesterton" },
  { text: "Impartiality is a pompous name for indifference, which is an elegant name for ignorance.", author: "G.K. Chesterton" },
  // C.S. Lewis (30)
  { text: "Courage, dear heart.", author: "C.S. Lewis" },
  { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
  { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
  { text: "Friendship is born at the moment when one person says to another: 'What! You too?'", author: "C.S. Lewis" },
  { text: "We meet no ordinary people in our lives.", author: "C.S. Lewis" },
  { text: "The future is something which everyone reaches at the rate of sixty minutes an hour.", author: "C.S. Lewis" },
  { text: "No one ever told me that grief felt so like fear.", author: "C.S. Lewis" },
  { text: "Humility is not thinking less of yourself, but thinking of yourself less.", author: "C.S. Lewis" },
  { text: "I believe in Christianity as I believe the sun has risen: not only because I see it, but because by it I see everything else.", author: "C.S. Lewis" },
  { text: "To love is to be vulnerable.", author: "C.S. Lewis" },
  { text: "There are far, far better things ahead than any we leave behind.", author: "C.S. Lewis" },
  { text: "The pain now is part of the happiness then. That's the deal.", author: "C.S. Lewis" },
  { text: "Children have one kind of silliness, and grown-ups have another kind.", author: "C.S. Lewis" },
  { text: "We are what we believe we are.", author: "C.S. Lewis" },
  { text: "You can't go back and change the beginning, but you can start where you are and change the ending.", author: "C.S. Lewis" },
  { text: "Miracles are a retelling in small letters of the very same story which is written across the whole world.", author: "C.S. Lewis" },
  { text: "The task of the modern educator is not to cut down jungles, but to irrigate deserts.", author: "C.S. Lewis" },
  { text: "What draws people to be friends is that they see the same truth.", author: "C.S. Lewis" },
  { text: "If I find in myself desires which nothing in this world can satisfy, the only logical explanation is that I was made for another world.", author: "C.S. Lewis" },
  { text: "I have been trying to make the best of a bad job. It is not the best that is the best; it is the trying that is the best.", author: "C.S. Lewis" },
  { text: "A children's story that can only be enjoyed by children is not a good children's story.", author: "C.S. Lewis" },
  { text: "The safest road to hell is the gradual one—the gentle slope, soft underfoot, without sudden turnings.", author: "C.S. Lewis" },
  { text: "Though our feelings come and go, His love for us does not.", author: "C.S. Lewis" },
  { text: "It is not your business to succeed, but to do right.", author: "C.S. Lewis" },
  { text: "The great thing is to be found at one's post as a child of God.", author: "C.S. Lewis" },
  { text: "We are not necessarily doubting that God will do the best for us; we are wondering how painful the best will turn out to be.", author: "C.S. Lewis" },
  { text: "Isn't it funny how day by day nothing changes, but when you look back, everything is different.", author: "C.S. Lewis" },
  { text: "Love is not affectionate feeling, but a steady wish for the loved person's ultimate good.", author: "C.S. Lewis" },
  { text: "He died not for men, but for each man.", author: "C.S. Lewis" },
  { text: "You can make anything by writing.", author: "C.S. Lewis" },
  // Terry Pratchett (30)
  { text: "It's still magic even if you know how it's done.", author: "Terry Pratchett" },
  { text: "The presence of those seeking the truth is infinitely to be preferred to the presence of those who think they've found it.", author: "Terry Pratchett" },
  { text: "Give a man a fire and he's warm for a day, but set fire to him and he's warm for the rest of his life.", author: "Terry Pratchett" },
  { text: "In ancient times cats were worshipped as gods; they have not forgotten this.", author: "Terry Pratchett" },
  { text: "Wisdom comes from experience. Experience is often a result of lack of wisdom.", author: "Terry Pratchett" },
  { text: "The truth may be out there, but the lies are inside your head.", author: "Terry Pratchett" },
  { text: "Real stupidity beats artificial intelligence every time.", author: "Terry Pratchett" },
  { text: "Build a man a fire, and he'll be warm for a day. Set a man on fire, and he'll be warm for the rest of his life.", author: "Terry Pratchett" },
  { text: "If you trust in yourself and believe in your dreams and follow your star, you'll still get beaten by people who spent their time working hard and learning things.", author: "Terry Pratchett" },
  { text: "The pen is mightier than the sword if the sword is very short, and the pen is very sharp.", author: "Terry Pratchett" },
  { text: "Time is a drug. Too much of it kills you.", author: "Terry Pratchett" },
  { text: "Light thinks it travels faster than anything but it is wrong. No matter how fast light travels, it finds the darkness has always got there first.", author: "Terry Pratchett" },
  { text: "Coming back to where you started is not the same as never leaving.", author: "Terry Pratchett" },
  { text: "It's not worth doing something unless someone, somewhere, would much rather you weren't doing it.", author: "Terry Pratchett" },
  { text: "Evil begins when you begin to treat people as things.", author: "Terry Pratchett" },
  { text: "The trouble with having an open mind, of course, is that people will insist on coming along and trying to put things in it.", author: "Terry Pratchett" },
  { text: "Freedom is having the right to be wrong, not the right to do wrong.", author: "Terry Pratchett" },
  { text: "Inside every old person is a young person wondering what happened.", author: "Terry Pratchett" },
  { text: "Stories of imagination tend to upset those without one.", author: "Terry Pratchett" },
  { text: "I'd rather be a rising ape than a falling angel.", author: "Terry Pratchett" },
  { text: "The whole of life is just like watching a film. Only it's as though you always get in ten minutes after the big picture has started.", author: "Terry Pratchett" },
  { text: "Sometimes the only way to deal with a madman is to take him seriously.", author: "Terry Pratchett" },
  { text: "The world is made up of stories, not atoms.", author: "Terry Pratchett" },
  { text: "There is a rumour going around that I have found God. I think this is unlikely because I have enough difficulty finding my keys.", author: "Terry Pratchett" },
  { text: "Five exclamation marks, the sure sign of an insane mind.", author: "Terry Pratchett" },
  { text: "Granny Weatherwax was not lost. She wasn't the kind of person who ever became lost.", author: "Terry Pratchett" },
  { text: "The presence of a seeker may be preferred, but not at the expense of the sought.", author: "Terry Pratchett" },
  { text: "People don't like change. But make the change fast enough and you go from one type of normal to another.", author: "Terry Pratchett" },
  { text: "What kind of man would put a known criminal in charge of a major branch of government?", author: "Terry Pratchett" },
  { text: "The best you can do is the best you can do.", author: "Terry Pratchett" },
];

/** Create a TTL-backed cache map for filter results. Keyed by string, entries expire after `ttl` ms. */
function createTtlCache(ttl) {
  const data = new Map();
  return {
    _map: data,
    clear() { data.clear(); },
    get(key) {
      const entry = data.get(key);
      if (entry && Date.now() - entry.ts < ttl) return entry.val;
      data.delete(key);
      return undefined;
    },
    set(key, val) { data.set(String(key), { val, ts: Date.now() }); },
    delete(key) { data.delete(String(key)); },
  };
}

/** Create a TTL-backed cache map. Each entry expires `ttl` ms after insertion. */
function createOppCache(ttl) {
  const data = new Map();
  return {
    _map: data,
    clear() { data.clear(); },
    get(id) {
      const entry = data.get(String(id));
      if (entry && Date.now() - entry.ts < ttl) return entry.val;
      data.delete(String(id));
      return undefined;
    },
    set(id, val) { data.set(String(id), { val, ts: Date.now() }); },
    invalidate(id) { data.delete(String(id)); },
  };
}

// ----- IndexedDB cache persistence -----
const IDB_NAME = "crm-kanban-cache";
const IDB_VERSION = 1;

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const name of ["tagCache", "customFieldCache", "filterResultCache"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function persistToIndexedDB(store, key, val) {
  openIndexedDB().then((db) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put({ val, ts: Date.now() }, key);
  }).catch(() => {});
}

function deleteFromIndexedDB(store, key) {
  openIndexedDB().then((db) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
  }).catch(() => {});
}

function clearIndexedDBStore(store) {
  openIndexedDB().then((db) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
  }).catch(() => {});
}

function hydrateCacheFromIndexedDB(store, cache, ttl) {
  return openIndexedDB().then((db) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).openCursor();
    return new Promise((resolve) => {
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { val, ts } = cursor.value;
          if (Date.now() - ts < ttl) cache._map.set(cursor.key, { val, ts });
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }).catch(() => {});
}

function enableCachePersistence(cache, store) {
  if (cache._persistenceEnabled) return;
  cache._persistenceEnabled = true;
  const origSet = cache.set.bind(cache);
  cache.set = (k, v) => { origSet(k, v); persistToIndexedDB(store, k, v); };
  const origClear = cache.clear.bind(cache);
  cache.clear = () => { origClear(); clearIndexedDBStore(store); };
  if (cache.invalidate) {
    const origInvalidate = cache.invalidate.bind(cache);
    cache.invalidate = (k) => { origInvalidate(k); deleteFromIndexedDB(store, k); };
  }
}

function hydrateAllCachesFromIndexedDB() {
  if (typeof indexedDB === "undefined") return;
  const t1 = hydrateCacheFromIndexedDB("tagCache", state.oppTagCache, OPP_TAG_CACHE_TTL_MS);
  const t2 = hydrateCacheFromIndexedDB("customFieldCache", state.oppCustomFieldCache, OPP_CUSTOM_FIELD_CACHE_TTL_MS);
  const t3 = hydrateCacheFromIndexedDB("filterResultCache", state.filterResultCache, FILTER_RESULT_CACHE_TTL_MS);
  return Promise.all([t1, t2, t3]).then(() => {
    // After hydration, attach persistence so future writes survive page reloads
    enableCachePersistence(state.oppTagCache, "tagCache");
    enableCachePersistence(state.oppCustomFieldCache, "customFieldCache");
    enableCachePersistence(state.filterResultCache, "filterResultCache");
  });
}

async function initCaches() {
  state.oppTagCache = state.oppTagCache || createOppCache(OPP_TAG_CACHE_TTL_MS);
  state.oppCustomFieldCache = state.oppCustomFieldCache || createOppCache(OPP_CUSTOM_FIELD_CACHE_TTL_MS);
  state.filterResultCache = state.filterResultCache || createTtlCache(FILTER_RESULT_CACHE_TTL_MS);
  if (typeof indexedDB !== "undefined") {
    await hydrateAllCachesFromIndexedDB();
  }
}

let userProfileReady = false;
let profileSaveTimer = null;

const state = {
  portalUrl: localStorage.getItem("oo_portal_url") || DEFAULT_PORTAL,
  stages: [],
  allTags: [],
  groups: [],
  currentUser: null,
  currentUserId: null,
  currentUserName: "",
  currentUserEmail: "",
  portalUsers: [],
  tasks: [],
  tileLayout: { order: [], widths: {}, heights: {} },
  hiddenFeedEntries: new Map(),
  feedKeywordFilter: "",
  feedNotificationsCache: [],
  feedFetchedAt: null,
  feedRawItems: [],
  feedPagination: null,
  feedLoading: false,
  calendarTiles: [],
  calendarCache: {},
  notesTiles: [],
  localKanbanTiles: [],  // local-only kanban boards (no CRM), persisted via profile like notes
  opportunityById: new Map(),
  groupTemplates: [],
  customFieldDefs: [],
  customFieldById: new Map(),
  taskCategories: [],
  newTaskOpportunity: { id: null, title: "" },
  dealEdit: null,
  quickNote: null,
  historyCategories: [],
  newOpportunityDraft: null,
  // Presence / Team feature runtime
  presenceUsersCache: null, // {fetchedAt: number, users: [...] } from server
  presenceData: null,       // last /api/presence snapshot
  presencePollTimer: null,
  presenceHeartbeatTimer: null,
  presenceIdleTimer: null,
  presenceModalOpen: false,
  presenceSelectedUserId: null,
  hasPresenceTile: false,   // persisted via tileLayout or a small flag; controls whether the tile is in the top panel
  bookmarkedDeals: [],      // [{ oppId, title, addedAt }]
  activeBookmarkTab: null,  // oppId of the expanded preview
};

function crmOpportunityUrl(id) {
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/CRM/Deals.aspx?id=${id}`;
}

function crmTaskUrl(task) {
  const ent = task.entity;
  if (ent?.entityType === "opportunity" && ent.entityId) {
    return crmOpportunityUrl(ent.entityId);
  }
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/CRM/Tasks.aspx`;
}

function groupFilterSummary(group) {
  const parts = [];
  if (group.tagTitles?.length) parts.push(`Tags: ${group.tagTitles.join(", ")}`);
  if (group.contactLabel) parts.push(`Contact: ${group.contactLabel}`);
  if (group.stageId) {
    const st = state.stages.find((s) => String(s.id) === String(group.stageId));
    if (st) parts.push(`Filter stage: ${st.title}`);
  }
  if (group.groupBy === "stage" && group.visibleStageIds?.length) {
    const n = group.visibleStageIds.length;
    const total = state.stages.length;
    if (n < total) parts.push(`${n} stage columns`);
  }
  if (group.groupBy === "stage" && group.showEmptyStages === false) {
    parts.push("Hiding empty stages");
  }
  if (group.dealStatus && group.dealStatus !== "all") {
    parts.push(group.dealStatus === "open" ? "Open deals" : "Closed deals");
  }
  if (group.showOnlyRedOpportunities) parts.push("Red opportunities only");
  return parts.join(" · ");
}

/** DOM refs must never be persisted — only live on in-memory group objects. */
const GROUP_RUNTIME_KEYS = ["_el", "_setFiltersCollapsed"];

function stripGroupRuntimeFields(group) {
  if (!group || typeof group !== "object") return {};
  const out = { ...group };
  for (const key of GROUP_RUNTIME_KEYS) delete out[key];
  return out;
}

function groupDomEl(group) {
  const el = group?._el;
  return el && typeof el.querySelectorAll === "function" ? el : null;
}

function updateGroupFilterSummary(group) {
  const root = groupDomEl(group);
  if (!root) return;
  const text = groupFilterSummary(group);
  root.querySelectorAll(".group-filter-summary, .group-filter-summary-compact").forEach((el) => {
    el.textContent = text;
  });
}

const $ = (sel, root = document) => root.querySelector(sel);

function showToast(message, type = null) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("error", "warning");
  if (type === 'error' || type === true) {
    el.classList.add("error");
  } else if (type === 'warning') {
    el.classList.add("warning");
  }
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), 5000);
}

// (removed all crash/queue banner code per request: no header banners for CRM unreachability.
// Progress bar + optional small header marquee (8s delayed, post-close) handle user notification.)

function unwrap(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.response)) return data.response;
  if (data.response && typeof data.response === "object" && !Array.isArray(data.response)) {
    return [data.response];
  }
  return [];
}

/** GET /api/2.0/crm/opportunity/tag/{id} returns plain tag title strings. */
function unwrapEntityTags(data) {
  const raw = unwrap(data);
  if (!raw.length && typeof data?.response === "string") {
    const s = data.response.trim();
    return s ? [s] : [];
  }
  return raw
    .map((t) => (typeof t === "string" ? t.trim() : normalizeTagTitle(t)))
    .filter(Boolean);
}

function sameUserId(a, b) {
  if (a == null || b == null || a === "" || b === "") return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function loadLayoutFromStorage() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY) || localStorage.getItem("oo_board_layout_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          order: Array.isArray(parsed.order) ? parsed.order : [],
          widths: parsed.widths && typeof parsed.widths === "object" ? parsed.widths : {},
          heights: parsed.heights && typeof parsed.heights === "object" ? parsed.heights : {},
          collapsed: parsed.collapsed && typeof parsed.collapsed === "object" ? parsed.collapsed : {},
          pinned: parsed.pinned && typeof parsed.pinned === "object" ? parsed.pinned : {},
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { order: [], widths: {}, heights: {}, collapsed: {}, pinned: {} };
}

function hiddenFeedCutoffTime() {
  return Date.now() - HIDDEN_FEED_RETENTION_MS;
}

function normalizeHiddenFeedEntries(raw) {
  const map = new Map();
  if (!Array.isArray(raw)) return map;
  const nowIso = new Date().toISOString();
  const cutoff = hiddenFeedCutoffTime();
  for (const item of raw) {
    let key = "";
    let hiddenAt = nowIso;
    let snapshot = null;
    if (typeof item === "string") {
      key = item.trim();
    } else if (item && typeof item === "object") {
      key = String(item.key || "").trim();
      hiddenAt = String(item.hiddenAt || "").trim() || nowIso;
      const snap = item.snapshot;
      if (snap && typeof snap === "object") {
        snapshot = {
          id: snap.id,
          title: String(snap.title || "").slice(0, 300),
          text: String(snap.text || "").slice(0, 500),
          author: String(snap.author || "").slice(0, 200),
          date: snap.date != null ? String(snap.date) : null,
        };
      }
    }
    if (!key || map.has(key)) continue;
    const hiddenMs = new Date(hiddenAt).getTime();
    if (!Number.isNaN(hiddenMs) && hiddenMs < cutoff) continue;
    map.set(key, { hiddenAt, snapshot });
  }
  return map;
}

function pruneHiddenFeedEntries(map = state.hiddenFeedEntries) {
  const cutoff = hiddenFeedCutoffTime();
  for (const [key, entry] of map) {
    const hiddenMs = new Date(entry.hiddenAt).getTime();
    if (Number.isNaN(hiddenMs) || hiddenMs < cutoff) map.delete(key);
  }
  return map;
}

function hiddenFeedEntriesToPayload(map) {
  const cutoff = hiddenFeedCutoffTime();
  const rows = [];
  for (const [key, entry] of map) {
    const hiddenMs = new Date(entry.hiddenAt).getTime();
    if (Number.isNaN(hiddenMs) || hiddenMs < cutoff) continue;
    const row = { key, hiddenAt: entry.hiddenAt };
    if (entry.snapshot) row.snapshot = entry.snapshot;
    rows.push(row);
  }
  return rows;
}

function serializeHiddenFeedEntries() {
  pruneHiddenFeedEntries();
  return hiddenFeedEntriesToPayload(state.hiddenFeedEntries);
}

function isFeedKeyHidden(key) {
  const entry = state.hiddenFeedEntries.get(key);
  if (!entry) return false;
  const hiddenMs = new Date(entry.hiddenAt).getTime();
  if (Number.isNaN(hiddenMs) || hiddenMs < hiddenFeedCutoffTime()) {
    state.hiddenFeedEntries.delete(key);
    return false;
  }
  return true;
}

function loadHiddenFeedEntriesFromStorage() {
  try {
    const raw = localStorage.getItem(HIDDEN_FEED_STORAGE_KEY);
    if (raw) return normalizeHiddenFeedEntries(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Map();
}

function saveHiddenFeedEntries() {
  const payload = serializeHiddenFeedEntries();
  localStorage.setItem(HIDDEN_FEED_STORAGE_KEY, JSON.stringify(payload));
  scheduleUserProfileSave();
  updateFeedHiddenToolbarButton();
}

function applyFeedUserPreferences(profile) {
  if (!profile || typeof profile !== "object") return;
  if (profile.feedKeywordFilter != null) {
    state.feedKeywordFilter = String(profile.feedKeywordFilter || "");
  }
  if (profile.hiddenFeedKeys != null) {
    state.hiddenFeedEntries = normalizeHiddenFeedEntries(profile.hiddenFeedKeys);
    pruneHiddenFeedEntries();
  }
  syncFeedKeywordInput();
  updateFeedHiddenToolbarButton();
}

function syncFeedKeywordInput() {
  const kw = $("#feed-keyword-filter");
  if (kw) kw.value = state.feedKeywordFilter || "";
}

function feedWindowStart() {
  return Date.now() - FEED_DAYS * 24 * 60 * 60 * 1000;
}

function feedFilterPlaceholder() {
  return "Filter by keyword (comma-separated, all must match)";
}

function syncFeedFilterPlaceholder() {
  const kw = $("#feed-keyword-filter");
  if (kw) kw.placeholder = feedFilterPlaceholder();
}

function isWithinFeedWindow(date) {
  if (!date) return true;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return true;
  return t >= feedWindowStart();
}

function feedNotificationKey(it) {
  const when = it.date ? new Date(it.date).getTime() : 0;
  return `${it.id}-${when}-${(it.text || "").slice(0, 80)}-${it.author || ""}`;
}

function saveLayoutToStorage() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.tileLayout));
  scheduleUserProfileSave();
}

function defaultTileOrder() {
  return [
    "tile-feed",
    "tile-tasks",
    ...state.groups.map((g) => `group-${g.id}`),
    ...state.calendarTiles.map((c) => calendarTileId(c)),
    ...activeNotesTiles().map((n) => notesTileId(n)),
    ...activeLocalKanbanTiles().map((k) => localKanbanTileId(k)),
  ];
}

function notesTileId(notes) {
  return `notes-${notes.id}`;
}

function localKanbanTileId(kanban) {
  return `local-kanban-${kanban.id}`;
}

function activeLocalKanbanTiles() {
  return (state.localKanbanTiles || []).filter(k => !k.archived);
}

function calendarTileId(cal) {
  return `calendar-${cal.id}`;
}

function isAutoRefreshTileId(tileId) {
  return PANEL_TILE_IDS.has(tileId) || (typeof tileId === "string" && tileId.startsWith("calendar-"));
}

function getCalendarByTileId(tileId) {
  const id = String(tileId || "").replace(/^calendar-/, "");
  return state.calendarTiles.find((c) => c.id === id) || null;
}

function ensureTileLayout() {
  const order = state.tileLayout.order?.length ? [...state.tileLayout.order] : defaultTileOrder();
  const known = new Set(defaultTileOrder());
  // Always include tile-presence in known tiles
  known.add("tile-presence");
  const filtered = order.filter((id) => known.has(id));
  for (const id of known) {
    if (!filtered.includes(id)) filtered.push(id);
  }
  state.tileLayout.order = filtered;
  for (const id of PANEL_TILE_IDS) {
    if (state.tileLayout.heights?.[id]) delete state.tileLayout.heights[id];
    if (!state.tileLayout.widths[id]) state.tileLayout.widths[id] = "half";
    if (!state.tileLayout.pinned) state.tileLayout.pinned = {};
    if (state.tileLayout.pinned[id] === undefined) state.tileLayout.pinned[id] = true;
  }
  // Always ensure tile-presence is pinned
  if (!state.tileLayout.pinned) state.tileLayout.pinned = {};
  state.tileLayout.pinned["tile-presence"] = true;
  if (!state.tileLayout.order.includes("tile-presence")) {
    state.tileLayout.order.push("tile-presence");
  }
  saveLayoutToStorage();
}

function tileWidth(tileId) {
  const w = state.tileLayout.widths[tileId];
  if (w === "quarter" || w === "half") return w;
  return "full";
}

function tileHeight(tileId) {
  return state.tileLayout.heights[tileId] === "double" ? "double" : "normal";
}

function setTileWidth(tileId, width) {
  state.tileLayout.widths[tileId] =
    width === "quarter" ? "quarter" : width === "half" ? "half" : "full";
  saveLayoutToStorage();
}

function setTileHeight(tileId, height) {
  state.tileLayout.heights[tileId] = height === "double" ? "double" : "normal";
  saveLayoutToStorage();
}

function tileBodyCollapsed(tileId) {
  return state.tileLayout.collapsed?.[tileId] === true;
}

function setTileBodyCollapsed(tileId, collapsed) {
  if (!state.tileLayout.collapsed) state.tileLayout.collapsed = {};
  if (collapsed) state.tileLayout.collapsed[tileId] = true;
  else delete state.tileLayout.collapsed[tileId];
  saveLayoutToStorage();
  mountDashboardTiles();
}

/** Tiles that fetch CRM (or calendar feed) data when expanded. Notes tiles are local-only. */
function isCrmDataTileId(tileId) {
  if (!tileId) return false;
  if (tileId === "tile-feed" || tileId === "tile-tasks") return true;
  if (tileId.startsWith("group-") || tileId.startsWith("calendar-")) return true;
  return false;
}

/** CRM‑origin tiles only (excludes 3rd‑party calendar). Used by the loading indicator. */
function isCrmOnlyTileId(tileId) {
  if (!tileId) return false;
  if (tileId === "tile-feed" || tileId === "tile-tasks") return true;
  if (tileId.startsWith("group-")) return true;
  return false;
}

function shouldFetchTileCrmData(tileId) {
  return isCrmDataTileId(tileId) && !tileBodyCollapsed(tileId);
}

function groupForTileId(tileId) {
  if (!tileId?.startsWith("group-")) return null;
  const groupId = tileId.slice("group-".length);
  return state.groups.find((g) => String(g.id) === String(groupId)) || null;
}

function dashboardTileIdsForLoad() {
  const ids = [...PINNED_TILE_IDS, ...(state.tileLayout.order || [])];
  return [...new Set(ids.filter(Boolean))];
}

function showTileCollapsedHint(tileId, message) {
  const tileEl = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tileEl || !tileBodyCollapsed(tileId)) return;
  if (tileId === "tile-feed") {
    const list = $("#notification-feed", tileEl);
    if (list) list.innerHTML = `<li class="feed-collapsed-hint">${escapeHtml(message)}</li>`;
    updatePanelTileCount("tile-feed", 0);
    return;
  }
  if (tileId === "tile-tasks") {
    const wrap = $(".tasks-by-user", tileEl);
    if (wrap) wrap.innerHTML = `<p class="tile-collapsed-hint">${escapeHtml(message)}</p>`;
    updatePanelTileCount("tile-tasks", 0);
    return;
  }
  if (tileId.startsWith("group-")) {
    const group = groupForTileId(tileId);
    const board = group?._el ? $(".board", group._el) : null;
    if (board) board.innerHTML = `<p class="tile-collapsed-hint">${escapeHtml(message)}</p>`;
    const countEl = group?._el?.querySelector(".board-group-count");
    if (countEl) countEl.textContent = "—";
    return;
  }
  if (tileId.startsWith("calendar-")) {
    const body = tileEl.querySelector(".calendar-month-body");
    if (body) body.innerHTML = `<p class="tile-collapsed-hint">${escapeHtml(message)}</p>`;
  }
}

function updateDashboardStatusText() {
  const openOpps = countOpenOpportunities();
  const openTasks = state.tasks.length;
  const skipped = dashboardTileIdsForLoad().filter(
    (id) => isCrmDataTileId(id) && tileBodyCollapsed(id)
  ).length;
  let text = `${openOpps} open opportunities · ${openTasks} open tasks`;
  if (skipped) text += ` · ${skipped} minimized tile${skipped === 1 ? "" : "s"} skipped`;
  const status = $("#status-text");
  if (status) status.textContent = text;
}

async function loadTileCrmData(tileId, { quiet = false, force = false } = {}) {
  if (!tileId || (!force && !shouldFetchTileCrmData(tileId))) return;

  if (tileId === "tile-feed") {
    await loadNotificationFeed({ force });
    return;
  }
  if (tileId === "tile-tasks") {
    await loadTasks();
    return;
  }
  if (tileId.startsWith("calendar-")) {
    const cal = getCalendarByTileId(tileId);
    if (cal) await loadCalendarForTile(cal, { quiet });
    return;
  }
  if (tileId.startsWith("group-")) {
    const group = groupForTileId(tileId);
    if (group) await refreshGroup(group, { force: true });
  }
}

async function loadExpandedDashboardTiles({ quiet = false } = {}) {
  const allIds = dashboardTileIdsForLoad();
  const crmJobs = [];
  const collapsibleIds = [];
  for (const tileId of allIds) {
    if (shouldFetchTileCrmData(tileId)) {
      crmJobs.push(tileId);
    } else if (isCrmDataTileId(tileId) && tileBodyCollapsed(tileId)) {
      collapsibleIds.push(tileId);
    }
  }

  for (const tileId of collapsibleIds) {
    showTileCollapsedHint(tileId, "Minimized — expand to load");
  }

  // Fire tile loads in background — never block the dashboard for these.
  // Each handles its own errors via try/catch and shows error state inline.
  // CRM‑origin tiles (groups, feed, tasks) are tracked for the loading indicator;
  // calendar (3rd‑party) loads independently and doesn't block the indicator.
  // Both fire as background promises; refreshAll can observe CRM completion
  // via the returned promise without blocking.
  const crmPromises = [];
  const calendarPromises = [];
  for (const tileId of crmJobs) {
    (isCrmOnlyTileId(tileId) ? crmPromises : calendarPromises).push(
      loadTileCrmData(tileId, { quiet }).catch(() => {})
    );
  }
  if (calendarPromises.length) {
    Promise.allSettled(calendarPromises).catch(() => {});
  }
  // Always return a promise so callers can observe completion without blocking.
  if (crmPromises.length) {
    return Promise.allSettled(crmPromises).then(() => {
      updateDashboardStatusText();
    }).catch(() => {});
  }
  updateDashboardStatusText();
  return Promise.resolve();
}

const PINNED_TILE_IDS = ["tile-feed", "tile-tasks", "tile-presence"];
const PANEL_TILE_IDS = new Set(PINNED_TILE_IDS);

function isTilePinnedToTop(tileId) {
  if (!PANEL_TILE_IDS.has(tileId)) return false;
  if (!state.tileLayout.pinned) state.tileLayout.pinned = {};
  if (state.tileLayout.pinned[tileId] === undefined) {
    state.tileLayout.pinned[tileId] = true; // default to pinned at top for feed + tasks
  }
  return !!state.tileLayout.pinned[tileId];
}

function setTilePinnedToTop(tileId, pinned) {
  if (!PANEL_TILE_IDS.has(tileId)) return;
  if (!state.tileLayout.pinned) state.tileLayout.pinned = {};
  state.tileLayout.pinned[tileId] = !!pinned;
  saveLayoutToStorage();
}

/** Ensure currently-pinned tiles (feed/tasks) appear first in the order array (in their relative user order).
 * This keeps them "at the top" logically, prevents other tiles from being ordered before them,
 * and makes L/R reordering within the pinned pair (when both pinned) and among mains clean and reliable.
 */
function normalizeOrderForPinned() {
  const ord = state.tileLayout.order;
  if (!ord || !ord.length) return;
  const pinnedNow = PINNED_TILE_IDS.filter((id) => isTilePinnedToTop(id));
  const pinnedPart = ord.filter((id) => pinnedNow.includes(id));
  const otherPart = ord.filter((id) => !pinnedNow.includes(id));
  // Preserve relative order within each group as user last arranged via drags
  if (pinnedPart.length !== pinnedNow.length || pinnedPart.join() !== pinnedNow.join() || otherPart.length + pinnedPart.length !== ord.length) {
    state.tileLayout.order = [...pinnedPart, ...otherPart];
  }
}

function saveFeedKeywordToStorage() {
  localStorage.setItem(FEED_KEYWORD_STORAGE_KEY, state.feedKeywordFilter || "");
  scheduleUserProfileSave();
}

function collectDashboardTileNodes() {
  const nodes = new Map();
  for (const container of [
    $("#dashboard-tiles-pinned"),
    $("#dashboard-panel-row"),
    $("#dashboard-tiles"),
  ]) {
    if (!container) continue;
    for (const child of [...container.children]) {
      if (child.dataset.tileId) nodes.set(child.dataset.tileId, child);
    }
  }
  return nodes;
}

function applyTileBodyCollapsed(tileEl, tileId) {
  if (!tileEl || !tileId) return;
  const collapsed = tileBodyCollapsed(tileId);
  tileEl.classList.toggle("tile-body-collapsed", collapsed);
  if (collapsed) {
    // Preserve width (half/quarter) so collapsed groups keep their "status" instead of going full-width.
    // Only strip double-height (vertical) as collapsed is horizontal bar.
    tileEl.classList.remove("tile-double");
  } else {
    applyTileLayoutClasses(tileEl, tileId);
  }
}

function applyTileLayoutClasses(tileEl, tileId) {
  if (!tileEl || !tileId) return;
  const isCurrentlyPinnedPanel = PANEL_TILE_IDS.has(tileId) && isTilePinnedToTop(tileId);
  if (isCurrentlyPinnedPanel) {
    if (state.tileLayout.heights?.[tileId]) {
      delete state.tileLayout.heights[tileId];
      saveLayoutToStorage();
    }
    tileEl.classList.add("panel-tile");
    tileEl.classList.remove("tile-double", "tile-half", "tile-quarter", "tasks-tile-full", "panel-width-quarter", "panel-width-half", "panel-width-full");
    syncPanelRowLayout();
    return;
  }
  // Non-pinned or regular tile: use normal grid classes (quarter/half/full + double height)
  tileEl.classList.remove("panel-tile", "panel-width-quarter", "panel-width-half", "panel-width-full");
  const w = tileWidth(tileId);
  const h = tileHeight(tileId);
  tileEl.classList.remove("tile-half", "tile-quarter");
  if (w === "half") tileEl.classList.add("tile-half");
  else if (w === "quarter") tileEl.classList.add("tile-quarter");
  if (tileBodyCollapsed(tileId)) {
    tileEl.classList.remove("tile-double", "tasks-tile-full");
    return;
  }
  tileEl.classList.toggle("tile-double", h === "double");

  // Notes narrow toolbar: put resizing (layouts + remove) on top row when quarter/half
  if (tileEl && tileEl.classList.contains('notes-tile')) {
    ensureNotesToolbarRows(tileEl);
  }
}

function createCollapseTileButton(tileEl, tileId) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost btn-collapse-tile tile-btn tile-btn-icon";
  const sync = () => {
    const collapsed = tileBodyCollapsed(tileId);
    const title = collapsed ? "Expand tile" : "Minimize tile";
    setTileLayoutIconButton(btn, collapsed ? TILE_ICON_TILE_EXPAND : TILE_ICON_MINIMIZE, title);
    btn.classList.toggle("tile-btn-active", collapsed);
    btn.setAttribute("aria-expanded", String(!collapsed));
    applyTileBodyCollapsed(tileEl, tileId);
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasCollapsed = tileBodyCollapsed(tileId);
    setTileBodyCollapsed(tileId, !wasCollapsed);
    sync();
    if (wasCollapsed && isCrmDataTileId(tileId)) {
      loadTileCrmData(tileId).catch((err) => showToast(err.message, true));
    } else if (!wasCollapsed && isCrmDataTileId(tileId)) {
      showTileCollapsedHint(tileId, "Minimized — expand to load");
    }
  });
  sync();
  return btn;
}

function attachTileCollapseButton(tileEl, tileId) {
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar, :scope > .group-tile-bar");
  if (!toolbar) return;
  const layoutBtns = toolbar.querySelector(".tile-layout-btns");
  if (!layoutBtns || layoutBtns.querySelector(".btn-collapse-tile")) return;
  const collapseBtn = createCollapseTileButton(tileEl, tileId);
  layoutBtns.insertBefore(collapseBtn, layoutBtns.firstChild);
}

function confirmDialog({ title, message, confirmLabel = "OK", danger = true }) {
  return new Promise((resolve) => {
    const modal = $("#confirm-modal");
    const titleEl = $("#confirm-modal-title");
    const msgEl = $("#confirm-modal-message");
    const okBtn = $("#confirm-modal-ok");
    const cancelBtn = $("#confirm-modal-cancel");
    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle("btn-danger", danger);
    okBtn.classList.toggle("btn-primary", !danger);
    modal.classList.remove("hidden");

    const close = (result) => {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.querySelectorAll("[data-confirm-dismiss]").forEach((el) => {
        el.removeEventListener("click", onCancel);
      });
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.querySelectorAll("[data-confirm-dismiss]").forEach((el) => {
      el.addEventListener("click", onCancel);
    });
    document.addEventListener("keydown", onKey);
    cancelBtn.focus();
  });
}

const TILE_ICON_WINDOW_RESTORE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="12" height="12" rx="1"/><rect x="8" y="4" width="12" height="12" rx="1"/></svg>`;

const TILE_ICON_WINDOW_MAXIMIZE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>`;

const TILE_ICON_HEIGHT_EXPAND = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/></svg>`;

const TILE_ICON_WINDOW_QUARTER = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="4" height="14" rx="0.5"/><rect x="10" y="5" width="4" height="14" rx="0.5"/><rect x="16" y="5" width="4" height="14" rx="0.5"/></svg>`;

const TILE_ICON_MINIMIZE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20h14"/></svg>`;

const TILE_ICON_TILE_EXPAND = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;

const TILE_ICON_COPY = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

const TILE_ICON_CALENDAR = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;

const TILE_ICON_PRINT = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/><path d="M6 10V6h12v4"/></svg>`;

const TILE_ICON_NOTE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`;

const TILE_ICON_TRASH = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

const TILE_ICON_ARCHIVE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="8" rx="2"/><path d="M2 10h20"/><path d="M2 14h20"/><path d="M2 18h20"/><path d="M6 6v4"/><path d="M18 6v4"/></svg>`;

const TILE_ICON_PIN = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z"/></svg>`;

const TILE_ICON_REMOVE = `<svg class="tile-remove-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

const TILE_ICON_SAVE = `<svg class="tile-layout-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l2.8 2.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`;

const FEED_LOADING_SPINNER_HTML = `<svg class="feed-loading-spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

function setTileLayoutIconButton(btn, iconHtml, title) {
  btn.classList.add("tile-btn", "tile-btn-icon");
  btn.innerHTML = iconHtml;
  btn.title = title;
  btn.setAttribute("aria-label", title);
}

function createTileIconActionButton(iconHtml, title, extraClass = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn btn-ghost tile-btn tile-btn-icon ${extraClass}`.trim();
  setTileLayoutIconButton(btn, iconHtml, title);
  return btn;
}

function createTileRemoveButton(title, extraClass = "") {
  return createTileIconActionButton(TILE_ICON_REMOVE, title, `btn-tile-remove ${extraClass}`.trim());
}

function closeAllTileMenus() {
  document.querySelectorAll(".tile-menu").forEach((menu) => menu.classList.add("hidden"));
  document.querySelectorAll(".tile-menu-trigger").forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
  });
}

function bindTileMenuDismiss() {
  if (document.body.dataset.tileMenuDismissBound) return;
  document.body.dataset.tileMenuDismissBound = "1";
  document.addEventListener("click", () => closeAllTileMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllTileMenus();
  });
}

function createTileMenu({ label, className = "", items }) {
  bindTileMenuDismiss();
  const wrap = document.createElement("div");
  wrap.className = "tile-menu-wrap";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = `btn btn-ghost tile-menu-trigger ${className}`.trim();
  trigger.textContent = label;
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "tile-menu hidden";
  menu.setAttribute("role", "menu");
  for (const item of items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "tile-menu-item";
    if (item.danger) row.classList.add("tile-menu-item--danger");
    row.textContent = item.label;
    row.setAttribute("role", "menuitem");
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllTileMenus();
      item.onSelect();
    });
    menu.appendChild(row);
  }
  wrap.appendChild(trigger);
  wrap.appendChild(menu);
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.classList.contains("hidden");
    closeAllTileMenus();
    if (willOpen) {
      menu.classList.remove("hidden");
      trigger.setAttribute("aria-expanded", "true");
    }
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  return wrap;
}

function createLayoutButtons({ showDoubleHeight = true, showQuarterWidth = false, showFullWidth = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "tile-layout-btns";

  let quarterBtn = null;
  if (showQuarterWidth) {
    quarterBtn = document.createElement("button");
    quarterBtn.type = "button";
    setTileLayoutIconButton(quarterBtn, TILE_ICON_WINDOW_QUARTER, "Quarter width (1/4)");
    wrap.appendChild(quarterBtn);
  }

  const halfBtn = document.createElement("button");
  halfBtn.type = "button";
  setTileLayoutIconButton(halfBtn, TILE_ICON_WINDOW_RESTORE, "Half width (1/2)");

  const fullBtn = document.createElement("button");
  fullBtn.type = "button";
  fullBtn.dataset.layout = "full";
  setTileLayoutIconButton(fullBtn, TILE_ICON_WINDOW_MAXIMIZE, "Full width");

  wrap.appendChild(halfBtn);
  if (showFullWidth) {
    wrap.appendChild(fullBtn);
  }

  let tallBtn = null;
  if (showDoubleHeight) {
    tallBtn = document.createElement("button");
    tallBtn.type = "button";
    tallBtn.className = "btn-tile-tall";
    setTileLayoutIconButton(tallBtn, TILE_ICON_HEIGHT_EXPAND, "Double tile height (two grid rows)");
    wrap.appendChild(tallBtn);
  }
  return { wrap, quarterBtn, halfBtn, fullBtn: showFullWidth ? fullBtn : null, tallBtn };
}

function bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn, quarterBtn = null) {
  const syncTileLayout = () => {
    const w = tileWidth(tileId);
    const h = tileHeight(tileId);
    if (quarterBtn) quarterBtn.classList.toggle("tile-btn-active", w === "quarter");
    halfBtn.classList.toggle("tile-btn-active", w === "half");
    if (fullBtn) fullBtn.classList.toggle("tile-btn-active", w === "full");
    if (tallBtn) tallBtn.classList.toggle("tile-btn-active", h === "double");
    applyTileLayoutClasses(tileEl, tileId);
    if (tileId === "tile-tasks") renderTasksByUser();
    if (PANEL_TILE_IDS.has(tileId)) syncPanelRowLayout();
  };
  quarterBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileWidth(tileId, "quarter");
    syncTileLayout();
  });
  halfBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileWidth(tileId, "half");
    syncTileLayout();
  });
  fullBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setTileWidth(tileId, "full");
    syncTileLayout();
  });
  if (tallBtn) {
    tallBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setTileHeight(tileId, tileHeight(tileId) === "double" ? "normal" : "double");
      syncTileLayout();
    });
  }
  syncTileLayout();
  return syncTileLayout;
}

function bindTilePinButton(tileEl, tileId, pinBtn) {
  if (!pinBtn || !PANEL_TILE_IDS.has(tileId)) return;
  const sync = () => {
    const pinned = isTilePinnedToTop(tileId);
    setTileLayoutIconButton(pinBtn, TILE_ICON_PIN, pinned ? "Unpin from top of dashboard" : "Pin to top of dashboard");
    pinBtn.classList.toggle("tile-btn-active", pinned);
  };
  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = !isTilePinnedToTop(tileId);
    setTilePinnedToTop(tileId, next);
    sync();
    mountDashboardTiles();
    // For the special feed/tasks tiles we always keep drag affordance enabled (even when pinned)
    // so the user can drag them left/right within the top area when both are pinned.
    // We do NOT touch the order array here (no normalize), so unpinning does not auto-reposition
    // the tile in the array / grid. It simply switches rendering layer (top containers vs main grid)
    // at its existing stable position in order; other tiles can only displace it via later drags.
    const tb = tileEl.querySelector(":scope > .tile-toolbar");
    if (tb) {
      tb.draggable = true;
      const h = tb.querySelector(".tile-drag-hint");
      if (h) h.classList.remove("hidden");
      bindTileDragDrop(tileEl, tileId, tb);
    }
  });
  sync();
}

function createTileChrome(tileId, label) {
  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");
  hint.title = "Drag to reorder (left/right or up/down)";

  const isPanel = PANEL_TILE_IDS.has(tileId) && isTilePinnedToTop(tileId);

  const name = document.createElement("span");
  name.className = "tile-toolbar-title";
  name.textContent = label;

  const countBadge = document.createElement("span");
  countBadge.className = "tile-toolbar-count";
  countBadge.dataset.tileCountFor = tileId;
  countBadge.textContent = "(0)";

  const spacer = document.createElement("span");
  spacer.className = "tile-toolbar-spacer";

  toolbar.appendChild(hint);
  toolbar.appendChild(name);
  toolbar.appendChild(countBadge);
  toolbar.appendChild(spacer);

  // Panel tiles (feed/tasks/presence): no layout buttons, no pin button — fixed equal width
  if (!isPanel) {
    const { wrap, quarterBtn, halfBtn, fullBtn, tallBtn } = createLayoutButtons({
      showDoubleHeight: true,
      showQuarterWidth: false,
    });
    toolbar.appendChild(wrap);
    return { toolbar, quarterBtn: null, halfBtn, fullBtn, tallBtn, pinBtn: null, layoutWrap: wrap };
  }

  return { toolbar, quarterBtn: null, halfBtn: null, fullBtn: null, tallBtn: null, pinBtn: null, layoutWrap: null };
}

function syncPanelRowLayout() {
  // All panel tiles are equal width — no layout sync needed
}

function updatePanelTileCount(tileId, count) {
  document.querySelectorAll(`[data-tile-count-for="${tileId}"]`).forEach((el) => {
    el.textContent = `(${count})`;
  });
}

function ensurePanelToolbarCount(tileEl, tileId) {
  if (!PANEL_TILE_IDS.has(tileId)) return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar) return;
  // Always enable drag + hint for the two special tiles (feed/notifications + tasks).
  // This makes them movable left/right at the top when pinned (and normal when unpinned), matching other tiles' reordering.
  toolbar.draggable = true;
  const hint = toolbar.querySelector(".tile-drag-hint");
  if (hint) hint.classList.remove("hidden");
  if (!toolbar.querySelector(`[data-tile-count-for="${tileId}"]`)) {
    const countBadge = document.createElement("span");
    countBadge.className = "tile-toolbar-count";
    countBadge.dataset.tileCountFor = tileId;
    countBadge.textContent = "(0)";
    const title = toolbar.querySelector(".tile-toolbar-title");
    if (title) title.after(countBadge);
    else toolbar.insertBefore(countBadge, toolbar.querySelector(".tile-toolbar-spacer"));
  }
}

function ensurePanelLayoutButtons(tileEl, tileId) {
  // Panel tiles have fixed equal width — no layout buttons
}

function ensurePanelPinButton(tileEl, tileId) {
  // Pin button removed — all panel tiles are always pinned
}

function bindTileChrome(tileEl, tileId) {
  if (!tileEl.querySelector(":scope > .tile-toolbar")) {
    const { toolbar, halfBtn, fullBtn, tallBtn } = createTileChrome(tileId, tileEl.dataset.tileLabel || "Section");
    if (halfBtn || fullBtn || tallBtn) {
      bindTileLayoutButtons(tileEl, tileId, halfBtn, fullBtn, tallBtn, null);
    }
    tileEl.prepend(toolbar);
    bindTileDragDrop(tileEl, tileId, toolbar);
  } else {
    ensurePanelToolbarCount(tileEl, tileId);
  }
  attachTileCollapseButton(tileEl, tileId);
  applyTileBodyCollapsed(tileEl, tileId);
  if (isAutoRefreshTileId(tileId)) ensureTileAutoRefreshButton(tileEl, tileId);
  if (tileId === "tile-feed") ensureFeedHiddenToolbarButton(tileEl);
  if (tileId === "tile-tasks") ensureTasksNewTaskButton(tileEl);
}

function bindTileDragDrop(tileEl, tileId, toolbar) {
  // Allow drag for feed/tasks tiles even when pinned: this enables left/right reordering within the top panel row (like other tiles support reordering).
  // The pinned ones still render visually at top (in their top containers), and other tiles cannot appear above them.
  if (tileEl.dataset.dragBound === "1") return;
  tileEl.dataset.dragBound = "1";

  toolbar.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", tileId);
    e.dataTransfer.effectAllowed = "move";
    tileEl.classList.add("dragging");
  });
  toolbar.addEventListener("dragend", () => {
    tileEl.classList.remove("dragging");
    document.querySelectorAll(".dashboard-tile.drag-over").forEach((n) => n.classList.remove("drag-over"));
  });

  tileEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    tileEl.classList.add("drag-over");
  });
  tileEl.addEventListener("dragleave", () => tileEl.classList.remove("drag-over"));
  tileEl.addEventListener("drop", (e) => {
    e.preventDefault();
    tileEl.classList.remove("drag-over");
    const fromId = e.dataTransfer.getData("text/plain");
    if (!fromId || fromId === tileId) return;
    const order = [...state.tileLayout.order];
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(tileId);
    if (fromIdx < 0 || toIdx < 0) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromId);
    state.tileLayout.order = order;
    normalizeOrderForPinned();
    saveLayoutToStorage();
    mountDashboardTiles();
  });
}

function loadGroupTemplates() {
  try {
    const raw = localStorage.getItem(GROUP_TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveGroupTemplatesToStorage() {
  localStorage.setItem(GROUP_TEMPLATES_STORAGE_KEY, JSON.stringify(state.groupTemplates));
  scheduleUserProfileSave();
}

function openTemplateDeleteModal() {
  const modal = $("#template-delete-modal");
  const listEl = $("#template-delete-list");
  if (!modal || !listEl) return;

  const renderList = () => {
    listEl.innerHTML = "";
    if (!state.groupTemplates || !state.groupTemplates.length) {
      listEl.innerHTML = '<p class="modal-message">No templates saved.</p>';
      return;
    }
    state.groupTemplates.forEach((tpl, idx) => {
      const row = document.createElement("div");
      row.className = "template-delete-row";
      row.innerHTML = `
        <span class="template-delete-name">${escapeHtml(tpl.name)}</span>
        <button type="button" class="btn btn-ghost btn-delete-tpl" title="Delete template" aria-label="Delete">×</button>
      `;
      const delBtn = row.querySelector(".btn-delete-tpl");
      delBtn.addEventListener("click", () => {
        if (!confirm(`Delete template “${tpl.name}”?`)) return;
        state.groupTemplates.splice(idx, 1);
        saveGroupTemplatesToStorage();
        renderBoardGroups(); // refresh selects in groups
        renderList(); // refresh this list
        showToast("Template deleted");
      });
      listEl.appendChild(row);
    });
  };

  renderList();

  // bind dismiss if not already
  if (!modal.dataset.bound) {
    modal.dataset.bound = "1";
    $("#template-delete-close")?.addEventListener("click", () => modal.classList.add("hidden"));
    modal.querySelectorAll("[data-template-delete-dismiss]").forEach((el) => {
      el.addEventListener("click", () => modal.classList.add("hidden"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
      }
    });
  }

  modal.classList.remove("hidden");
}

function groupConfigSnapshot(group) {
  return JSON.parse(JSON.stringify(stripGroupRuntimeFields(group)));
}

function applyGroupTemplate(group, template) {
  const cfg = stripGroupRuntimeFields(template.config || template);
  const keep = { id: group.id, opportunities: group.opportunities || [], _el: groupDomEl(group) };
  Object.assign(group, newGroup(), cfg, keep);
  const el = groupDomEl(group);
  if (el) {
    el.dataset.tileLabel = group.name || "Opportunity group";
    const nameInput = $(".group-tile-name", el);
    if (nameInput) nameInput.value = group.name;
    updateGroupFilterSummary(group);
  }
}

function bindGroupTileChrome(section, group, tileId) {
  if (section.querySelector(":scope > .group-tile-bar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar group-tile-bar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");
  hint.title = "Drag to reorder (left/right or up/down)";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "group-tile-name";
  nameInput.placeholder = "Group label";
  nameInput.value = group.name || "";
  nameInput.setAttribute("aria-label", "Group label");

  const countEl = document.createElement("span");
  countEl.className = "group-tile-count board-group-count";
  countEl.textContent = "0 deals";

  const summaryCompactBar = document.createElement("span");
  summaryCompactBar.className = "group-filter-summary-compact";
  summaryCompactBar.textContent = groupFilterSummary(group);

  const toggleFiltersBtn = document.createElement("button");
  toggleFiltersBtn.type = "button";
  toggleFiltersBtn.className = "btn btn-ghost btn-toggle-filters";
  toggleFiltersBtn.textContent = "Hide filters";

  const templateSelect = document.createElement("select");
  templateSelect.className = "group-tile-templates";
  templateSelect.title = "Apply a saved template";
  const tplOpt0 = document.createElement("option");
  tplOpt0.value = "";
  tplOpt0.textContent = "Templates…";
  templateSelect.appendChild(tplOpt0);
  for (const t of state.groupTemplates) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    templateSelect.appendChild(opt);
  }

  const saveTplBtn = createTileIconActionButton(
    TILE_ICON_SAVE,
    "Save current filters as a template",
    "btn-save-template"
  );

  const manageTplBtn = createTileIconActionButton(
    TILE_ICON_TRASH,
    "Delete saved templates",
    "btn-manage-templates"
  );

  const removeBtn = createTileRemoveButton("Remove this grouping from the board", "btn-remove-group");

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons();

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(countEl);
  toolbar.appendChild(summaryCompactBar);
  toolbar.appendChild(toggleFiltersBtn);
  toolbar.appendChild(templateSelect);
  toolbar.appendChild(saveTplBtn);
  toolbar.appendChild(manageTplBtn);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);

  const setFiltersCollapsed = (collapsed) => {
    group.filtersCollapsed = collapsed;
    section.classList.toggle("filters-collapsed", collapsed);
    toggleFiltersBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleFiltersBtn.textContent = collapsed ? "Show filters" : "Hide filters";
    saveGroupsToStorage();
  };
  setFiltersCollapsed(!!group.filtersCollapsed);
  toggleFiltersBtn.addEventListener("click", () => setFiltersCollapsed(!group.filtersCollapsed));

  nameInput.addEventListener("input", () => {
    group.name = nameInput.value;
    section.dataset.tileLabel = group.name || "Opportunity group";
    saveGroupsToStorage();
  });
  nameInput.addEventListener("change", () => {
    group.name = nameInput.value.trim() || "New group";
    nameInput.value = group.name;
    section.dataset.tileLabel = group.name;
    saveGroupsToStorage();
  });

  templateSelect.addEventListener("change", () => {
    const id = templateSelect.value;
    templateSelect.value = "";
    if (!id) return;
    const tpl = state.groupTemplates.find((t) => t.id === id);
    if (!tpl) return;
    applyGroupTemplate(group, tpl);
    saveGroupsToStorage();
    renderBoardGroups();
    refreshGroup(group).catch((err) => showToast(err.message, true));
    showToast(`Applied template “${tpl.name}”`);
  });

  saveTplBtn.addEventListener("click", () => {
    const name = prompt("Template name", group.name || "My filters");
    if (!name?.trim()) return;
    const tpl = { id: crypto.randomUUID(), name: name.trim(), config: groupConfigSnapshot(group) };
    state.groupTemplates.push(tpl);
    saveGroupTemplatesToStorage();
    renderBoardGroups();
    showToast(`Saved template “${tpl.name}”`);
  });

  manageTplBtn.addEventListener("click", () => {
    openTemplateDeleteModal();
  });

  removeBtn.addEventListener("click", async () => {
    if (state.groups.length <= 1) {
      showToast("Keep at least one group", true);
      return;
    }
    const label = group.name?.trim() || "this group";
    const ok = await confirmDialog({
      title: "Remove grouping?",
      message: `Remove “${label}” from the board? This cannot be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const tid = `group-${group.id}`;
    state.groups = state.groups.filter((g) => g.id !== group.id);
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    saveGroupsToStorage();
    saveLayoutToStorage();
    // Flush immediately (beyond debounce) so reloads after quick remove don't resurrect the tile from server profile.
    saveUserProfileToServer({ quiet: true }).catch(() => {});
    // Re-render the board (groups + calendars + notes + local kanbans) cleanly.
    // Do NOT call refreshAll() here — it does a full data reload + profile re-fetch which can race
    // with saves and clobber client-only tiles like local kanbans (and feels like an unwanted page refresh).
    renderBoardGroups();
  });

  group._setFiltersCollapsed = setFiltersCollapsed;
}

function mountPanelTile(node, tileId, parent) {
  if (!node || !parent) return;
  parent.appendChild(node);
  node.classList.remove("tile-half", "tile-double", "tile-quarter", "tasks-tile-full");
  node.classList.add("panel-tile");
  // Slot classes for left/right are set by the caller (mountDashboardTiles) based on position
  // in the current pinned list. This allows the two tiles to be swapped L<->R by the user
  // while both are pinned at the top (they remain visually above the main grid).
  applyTileBodyCollapsed(node, tileId);
  if (!tileBodyCollapsed(tileId)) applyTileLayoutClasses(node, tileId);
}

function mountDashboardTiles() {
  const root = $("#dashboard-tiles");
  const panelRow = $("#dashboard-panel-row");
  const pinnedRoot = $("#dashboard-tiles-pinned");
  if (!root) return;
  ensureTileLayout();

  // Ensure presence tile element exists (always visible, not removable)
  if (!document.querySelector('[data-tile-id="tile-presence"]')) {
    renderPresenceTile();
  }

  const nodes = collectDashboardTileNodes();
  if (pinnedRoot) pinnedRoot.innerHTML = "";
  if (panelRow) panelRow.innerHTML = "";
  root.innerHTML = "";

  let hasPinned = false;
  // Build the list of pinned tiles in the sequence they appear in the user's tileLayout.order.
  // This makes the two tiles (notifications + tasks) reorderable left<->right while pinned at the top,
  // just like other tiles can be reordered. The top containers always place them above the main grid,
  // so other tiles cannot be put above pinned ones visually.
  const currentOrder = state.tileLayout.order || [];
  let pinnedToRender = currentOrder.filter((id) => PANEL_TILE_IDS.has(id) && isTilePinnedToTop(id));
  // Defensive: include any pinned tiles missing from order
  for (const id of PINNED_TILE_IDS) {
    if (isTilePinnedToTop(id) && !pinnedToRender.includes(id)) pinnedToRender.push(id);
  }
  let pinnedIdx = 0;
  for (const tileId of pinnedToRender) {
    const node = nodes.get(tileId);
    if (!node) continue;
    // Assign slot classes by current position among pinned (supports swap)
    const isLeft = pinnedIdx === 0;
    const isRight = pinnedIdx === 1;
    node.classList.toggle("panel-slot-left", isLeft);
    node.classList.toggle("panel-slot-right", isRight);
    if (tileBodyCollapsed(tileId)) {
      mountPanelTile(node, tileId, pinnedRoot);
    } else {
      mountPanelTile(node, tileId, panelRow);
    }
    hasPinned = true;
    pinnedIdx++;
  }

  if (pinnedRoot) pinnedRoot.classList.toggle("hidden", !hasPinned);
  syncPanelRowLayout();

  for (const tileId of state.tileLayout.order) {
    if (PANEL_TILE_IDS.has(tileId) && isTilePinnedToTop(tileId)) continue;
    const node = nodes.get(tileId);
    if (!node) continue;
    root.appendChild(node);
    node.classList.remove("panel-slot-left", "panel-slot-right");
    applyTileLayoutClasses(node, tileId);
    applyTileBodyCollapsed(node, tileId);
  }
}

function renderFeedTile() {
  const tileId = "tile-feed";
  let tile = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tile) {
    tile = document.createElement("section");
    tile.className = "dashboard-tile panel feed-panel";
    tile.dataset.tileId = tileId;
    tile.dataset.tileLabel = "CRM notifications";
    tile.innerHTML = `
      <div class="panel-header panel-header-feed">
        <input type="search" id="feed-keyword-filter" class="feed-keyword-filter" placeholder="${escapeHtml(feedFilterPlaceholder())}" autocomplete="off" />
        <span class="feed-loading-indicator hidden" title="Loading notifications" aria-label="Loading notifications">${FEED_LOADING_SPINNER_HTML}</span>
        <span class="panel-sub feed-range-hint">Last ${FEED_DAYS} days</span>
      </div>
      <ul id="notification-feed" class="feed-list" aria-live="polite"></ul>
    `;
    $("#dashboard-panel-row")?.appendChild(tile);
    bindTileChrome(tile, tileId);
    bindFeedInfiniteScroll();
    const kw = $("#feed-keyword-filter", tile);
    if (kw) {
      kw.value = state.feedKeywordFilter || "";
      kw.addEventListener("input", () => {
        state.feedKeywordFilter = kw.value;
        saveFeedKeywordToStorage();
        renderFeedNotificationList();
      });
    }
  }
  applyTileLayoutClasses(tile, tileId);
  ensurePanelToolbarCount(tile, tileId);
  ensureTileAutoRefreshButton(tile, tileId);
  ensureFeedHiddenToolbarButton(tile);
  syncFeedFilterPlaceholder();
  const kw = $("#feed-keyword-filter", tile);
  if (kw) {
    kw.value = state.feedKeywordFilter || "";
    if (!kw.dataset.bound) {
      kw.dataset.bound = "1";
      kw.addEventListener("input", () => {
        state.feedKeywordFilter = kw.value;
        saveFeedKeywordToStorage();
        renderFeedNotificationList();
      });
    }
  }
  bindFeedInfiniteScroll();
  return tile;
}

function renderTasksTile() {
  const tileId = "tile-tasks";
  let tile = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tile) {
    tile = document.createElement("section");
    tile.className = "dashboard-tile panel tasks-panel";
    tile.dataset.tileId = tileId;
    tile.dataset.tileLabel = "Tasks";
    tile.innerHTML = `
      <div class="panel-header panel-header-tasks">
        <label class="tasks-filter-label panel-sub">
          User
          <select id="tasks-user-filter"></select>
        </label>
      </div>
      <div id="tasks-by-user" class="tasks-by-user"></div>
    `;
    $("#dashboard-panel-row")?.appendChild(tile);
    bindTileChrome(tile, tileId);
  }
  applyTileLayoutClasses(tile, tileId);
  ensurePanelToolbarCount(tile, tileId);
  ensureTileAutoRefreshButton(tile, tileId);
  ensureTasksNewTaskButton(tile);
  if (tile && !tile.dataset.tasksFilterBound) {
    tile.dataset.tasksFilterBound = "1";
    $("#tasks-user-filter", tile)?.addEventListener("change", () => {
      loadTasks().catch((err) => showToast(err.message, true));
    });
  }
  return tile;
}

function refreshDashboardTileLayouts() {
  document.querySelectorAll(".dashboard-tile[data-tile-id]").forEach((el) => {
    const id = el.dataset.tileId;
    attachTileCollapseButton(el, id);
    applyTileBodyCollapsed(el, id);
    if (tileBodyCollapsed(id) && isCrmDataTileId(id)) {
      const msg =
        id === "tile-feed"
          ? "Minimized — expand to load notifications"
          : id === "tile-tasks"
            ? "Minimized — expand to load tasks"
            : id.startsWith("calendar-")
              ? "Minimized — expand to load calendar"
              : "Minimized — expand to load deals";
      showTileCollapsedHint(id, msg);
    }
  });
}

function parseApiError(body, status) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return body.slice(0, 300) || `HTTP ${status}`;
    }
  }
  if (body?.message) return String(body.message);
  if (body?.error?.message) return String(body.error.message);
  if (body?.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
  if (body?.detail) return typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
  return `HTTP ${status}`;
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;

  const res = await fetch(`/api/proxy${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      throw new Error(text.slice(0, 300) || res.statusText);
    } else {
      // Some endpoints (e.g. form-urlencoded history with attachments) may return non-JSON on success.
      // Do not throw; return a minimal object so caller can proceed.
      body = {};
    }
  }
  if (!res.ok) {
    const msg = parseApiError(body, res.status);
    const err = new Error(msg);
    if (options.showCrashBanner !== false) {
      const lower = msg.toLowerCase();
      if (res.status >= 500 || /502|503|504|500|5\d{2}|bad gateway|unavailable|proxy|gateway/.test(lower)) {
        showCrmCrashBanner();
      }
    }
    throw err;
  }
  // Successful CRM-ish call
  if (/\/crm\//i.test(path)) {
    onCRMSuccess();
    // If we have queued mutations, a successful CRM response is a good signal that the backend
    // may be back — kick the processor to drain the queue promptly on recovery.
    if (mutationQueue.length > 0) {
      setTimeout(() => { processMutationQueue().catch(() => {}); }, 10);
    }
  }
  return body;
}

// --- Mutation Queue (client-side offline / transient CRM write resilience) ---
// All CRM writes that hit transient errors are queued (localStorage) and retried in bg.
// On timeout after CONNECTING_GRACE, progress bar notifies "server unreachable, adding to queue".
// Header marquee (scrolling, tiny) only appears >8s after queue item + after any modal closed.
// No header warning/crash/queue banners are ever created (removed per spec).

let mutationQueue = [];

/* Note attachments queue list (for history notes with files).
   Shows all pending (from mutationQueue) + recently completed.
   Completed entries auto-prune after 10s. */
let noteQueueCompleted = [];

let connectionState = 'connected'; // 'connected' | 'connecting' | 'disconnected'
let connectingTimer = null;
const CONNECTING_GRACE_MS = 10000; // grace before marking a push as queued (progress bar shows unreachable + queue msg)
const QUEUE_MARQUEE_DELAY_MS = 8000; // for pending count / stale in marquee (only when there are actual queued push failures)
let lastCRMSuccessTime = Date.now();

let _syncStatusEl = null;

function loadMutationQueue() {
  try {
    const raw = localStorage.getItem(MUTATION_QUEUE_KEY);
    mutationQueue = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(mutationQueue)) mutationQueue = [];
  } catch {
    mutationQueue = [];
  }
  updateNoteQueueList();
}

function persistMutationQueue() {
  try {
    localStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(mutationQueue));
  } catch {
    // localStorage full or unavailable — best effort
  }
}

function getMutationQueue() {
  return [...mutationQueue];
}

function isTransientError(err) {
  if (!err) return false;
  const msg = String(err.message || err || "").toLowerCase();
  // Very broad match for anything that looks like a temporary server/network/proxy/CRM-backend problem.
  // Covers real CRM being down (portal returns 502/503 with various bodies, URLError from proxy, etc.).
  if (/typeerror|network|fetch failed|failed to fetch|timeout|econn|enotfound|resolve host|could not resolve|connection refused|unavailable|offline|bad gateway|gateway|upstream|service unavailable|backend|proxy/.test(msg)) {
    return true;
  }
  if (/502|503|504|500|5\d{2}/.test(msg) || /http 5\d\d/.test(msg) || /\b5[0-9]{2}\b/.test(msg)) {
    return true;
  }
  // Known OnlyOffice/CRM proxy error strings when its backend CRM services are unreachable
  if (/could not resolve crm|crm user|resolve crm/.test(msg)) {
    return true;
  }
  return false;
}

function enqueueCrmMutation(descriptor) {
  if (!descriptor || !descriptor.path) return;
  if (mutationQueue.length >= MAX_QUEUE_SIZE) {
    mutationQueue.shift(); // drop oldest on cap
  }
  const item = {
    id: (Date.now() + Math.random()).toString(36),
    ts: Date.now(),
    ...descriptor,
  };
  mutationQueue.push(item);
  persistMutationQueue();
  updateMutationSyncStatus();
  // Kick the processor shortly after enqueue
  setTimeout(() => { processMutationQueue().catch(() => {}); }, 50);
}

let _mqInFlight = false;

async function processMutationQueue() {
  if (_mqInFlight) return;
  if (!navigator.onLine) return;
  _mqInFlight = true;
  try {
    while (mutationQueue.length > 0) {
      if (!navigator.onLine) break;
      const item = mutationQueue[0];
      try {
        await api(item.path, {
          method: item.method || "POST",
          headers: item.headers || { "Content-Type": "application/json" },
          body: item.body || undefined,
          showCrashBanner: false,
        });
        // Success — remove, persist, notify, and reconcile
        mutationQueue.shift();
        persistMutationQueue();
        updateMutationSyncStatus();
        onCRMSuccess();
        if (item.opType === "history") {
          addCompletedNoteQueueEntry({
            preview: item.notePreview,
            attachmentNames: item.attachmentNames || [],
            failedNames: item.failedAttachmentNames || [],
            status: "success",
          });
        }
        try {
          showToast(`Synced: ${item.description || 'CRM action'}`);
        } catch {}
        // Light reconciliation. loadTasks covers task creates/closes.
        // For opportunity mutations the optimistic state + next natural group load/refresh is usually sufficient;
        // we can expand this later with targeted refreshGroup if needed.
        loadTasks().catch(() => {});
        if (item.opType === 'task') {
          // Also refresh the full tasks list modal if it's currently open, so newly synced
          // tasks (created while offline) appear without the user having to close/re-open.
          const listModal = $("#tasks-list-modal");
          if (listModal && !listModal.classList.contains("hidden")) {
            // Re-fetch by hiding and re-opening the modal (listeners are re-bound but acceptable for this flow).
            listModal.classList.add("hidden");
            setTimeout(() => {
              try { openTasksListModal(); } catch {}
            }, 80);
          }
        }
        // Gentle full refresh for opp changes (quiet).
        // NOTE: 'history' (event notes) intentionally omitted — adding a note does not change board cards/tiles,
        // and the full refreshAll (profile + renders) was causing perceived UI hang shortly after send.
        // Defer to avoid blocking clicks / main thread during/after pushes.
        if (item.opType === 'stage' || item.opType === 'due' || item.opType === 'tag') {
          if (item.opType === 'tag' && item.oppId != null) {
            state.oppTagCache?.invalidate(item.oppId);
          }
          setTimeout(() => { refreshAll().catch(() => {}); }, 50);
        }
      } catch (err) {
        // Only drop queued actions on clear *permanent client errors* (bad data that will never succeed
        // even when CRM is healthy). Anything network/5xx/unknown/server-down related must stay in the
        // queue and keep retrying. This prevents the scary "action dropped non-retryable" toast during
        // normal "CRM server is down" testing or transient outages.
        const m = String(err && err.message || err || "").toLowerCase();
        const status = parseInt((m.match(/\b([45]\d{2})\b/) || [0, 0])[1], 10);
        const isPermanentClientError =
          (status >= 400 && status < 500 && status !== 429 && status !== 408) ||
          /bad request|validation|invalid (request|data|field|value|id)|malformed|missing required|cannot (create|update)|not allowed|forbidden|unauthorized/.test(m);

        if (isPermanentClientError && !isTransientError(err)) {
          mutationQueue.shift();
          persistMutationQueue();
          if (item.opType === "history") {
            addCompletedNoteQueueEntry({
              preview: item.notePreview,
              attachmentNames: item.attachmentNames || [],
              failedNames: item.failedAttachmentNames || [],
              status: "fail",
            });
          }
          try {
            showToast(`Sync failed for "${item.description || item.path}". Action dropped (non-retryable client error).`, true);
          } catch {}
          continue;
        }
        // Transient (including all CRM-down, proxy, 5xx, network cases) — keep in queue for retry
        break;
      }
    }
  } finally {
    _mqInFlight = false;
  }
  updateMutationSyncStatus();
}

function updateMutationSyncStatus() {
  const el = $("#mutation-sync-status");
  if (!el) return;
  const count = mutationQueue.length;
  const now = Date.now();
  const hasStaleQueued = mutationQueue.some(item => now - (item.ts || 0) > QUEUE_MARQUEE_DELAY_MS);
  const showPill = hasStaleQueued && count > 0 && (now - lastCRMSuccessTime > QUEUE_MARQUEE_DELAY_MS);

  if (count > 0 && showPill) {
    el.textContent = `${count} pending`;
    el.classList.remove("hidden");
    el.title = `${count} CRM action(s) queued for sync`;
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }

  // Header marquee indicator (scrolling, minimal): only shows for actual stale queued items from push failures.
  // (Global time-based + periodic poller removed to stop frequent false positives.)
  updateCrmHeaderMarquee(count, hasStaleQueued);
  updateNoteQueueList();
}

function updateNoteQueueList() {
  const el = $("#note-queue-list");
  if (!el) return;

  const items = [];

  // Pending history items from the main mutation queue (not yet sent or retrying)
  for (const item of mutationQueue) {
    if (item.opType === "history") {
      const preview = item.notePreview || "(note)";
      const atts = (item.attachmentNames || []).join(", ");
      const fails = (item.failedAttachmentNames || []).join(", ");
      let text = preview;
      if (atts) text += ` + ${atts}`;
      if (fails) text += ` (some failed: ${fails})`;
      items.push(`<span class="note-queue-item">⏳ ${escapeHtml(text)}</span>`);
    }
  }

  // Completed (success or fail) — will be pruned by their own timers
  for (const c of noteQueueCompleted) {
    const preview = c.preview || "(note)";
    let text = preview;
    if (c.attachmentNames && c.attachmentNames.length) text += ` + ${c.attachmentNames.join(", ")}`;
    if (c.failedNames && c.failedNames.length) text += ` (failed: ${c.failedNames.join(", ")})`;
    const cls = c.status === "success" ? "success" : "fail";
    const icon = c.status === "success" ? "✓" : "✕";
    items.push(`<span class="note-queue-item ${cls}">${icon} ${escapeHtml(text)}</span>`);
  }

  el.innerHTML = items.join("");
}

function addCompletedNoteQueueEntry({ preview, attachmentNames = [], failedNames = [], status }) {
  const entry = {
    id: Date.now() + Math.random(),
    preview,
    attachmentNames,
    failedNames,
    status: status || "success",
    completedAt: Date.now(),
  };
  noteQueueCompleted.push(entry);
  // Auto clear this entry after exactly 10s (per spec: "10 second timer on completion")
  setTimeout(() => {
    noteQueueCompleted = noteQueueCompleted.filter((e) => e.id !== entry.id);
    updateNoteQueueList();
  }, 10000);
  updateNoteQueueList();
}

function updateCrmHeaderMarquee(count, hasStale) {
  const marquee = $("#crm-header-marquee");
  if (!marquee) return;

  const openModal = document.querySelector(".modal:not(.hidden)");
  // Only show for actual stale queued actions from failed pushes (original behavior).
  // Removed global "time since last success" check + periodic poller that was causing frequent false "unreachable" indicators.
  const shouldShow = !openModal && (count > 0 && hasStale);

  if (shouldShow) {
    let text = `❗ CRM unreachable — actions queued locally until restored`;
    if (count > 0) text += ` (${count} pending)`;
    // Use duplicated content for seamless scroll
    marquee.innerHTML = `<span>${text} • ${text}</span>`;
    marquee.classList.remove("hidden");
    marquee.style.display = "";

    // Once the header marquee (the connectivity indicator) is visible and carrying the pending count,
    // the bottom progress bar is redundant — hide it. The marquee is now the persistent signal.
    try { hideCRMSyncStatus(); } catch {}
    const pill = $("#mutation-sync-status");
    if (pill) {
      pill.classList.add("hidden");
      pill.textContent = "";
    }
  } else {
    marquee.classList.add("hidden");
    marquee.style.display = "none";
    marquee.innerHTML = "";
  }
}

function getSyncStatusEl() {
  if (!_syncStatusEl || !_syncStatusEl.parentNode) {
    _syncStatusEl = document.createElement("div");
    _syncStatusEl.id = "crm-sync-status";
    _syncStatusEl.className = "crm-sync-status";
    document.body.appendChild(_syncStatusEl);
  }
  return _syncStatusEl;
}

function showCRMSyncStatus(text, isWarning = false) {
  const marquee = $("#crm-header-marquee");
  const marqueeActive = marquee && !marquee.classList.contains("hidden") && marquee.style.display !== "none";

  // When the header marquee is the active persistent "unreachable + N pending" indicator,
  // suppress the bottom progress bar (it carries overlapping info).
  if (marqueeActive && isWarning) {
    // For the persistent warning state, let the marquee own it.
    return;
  }

  const el = getSyncStatusEl();
  el.innerHTML = `<span>${text}</span><div class="progress"><div class="progress-bar"></div></div>`;
  if (isWarning) {
    el.classList.add("warning");
  } else {
    el.classList.remove("warning");
  }
  el.style.display = "";
}

function hideCRMSyncStatus() {
  if (_crmRefreshing) {
    // Don't hide the bar during a global CRM refresh — restore the refresh message
    // so the user still sees progress. Individual mutations (deal edit, notes, etc.)
    // may have temporarily overridden it with their own status text.
    showCRMSyncStatus("Loading CRM data…");
    return;
  }
  if (_syncStatusEl) {
    _syncStatusEl.style.display = "none";
    _syncStatusEl.classList.remove("warning");
  }
}

function clearConnectingTimer() {
  if (connectingTimer) {
    clearTimeout(connectingTimer);
    connectingTimer = null;
  }
}

function setConnectionState(newState) {
  if (connectionState === newState) return;
  connectionState = newState;
  updateMutationSyncStatus();
}

function startConnectingGrace(descriptor) {
  setConnectionState('connecting');
  showCRMSyncStatus('Connecting...');

  clearConnectingTimer();
  connectingTimer = setTimeout(() => {
    // Only confirm failed if we are STILL in connecting after full 10s.
    // This means the push is stuck and we switch to queue. Success would have cleared the timer.
    if (connectionState === 'connecting') {
      setConnectionState('disconnected');
      // The persistent signal is the header marquee (after its 8s delay + post-close check).
      // Hide any bottom bar message here so we don't leave stale "unreachable" text when the
      // marquee takes over.
      hideCRMSyncStatus();
    }
  }, CONNECTING_GRACE_MS);
}

function onCRMSuccess() {
  clearConnectingTimer();
  lastCRMSuccessTime = Date.now();
  setConnectionState('connected');
  hideCrmCrashBanner();
  // Do NOT auto-hide here. The "sent successfully" messages in form handlers control
  // a deliberate linger (so the progress bar is visible for a readable moment even on fast success).
  // General CRM successes will rely on the per-action "sent" calls or other hides.
}

function showCrmCrashBanner() {
  const el = $("#crm-crash-banner");
  if (!el) return;
  el.textContent = "CRM is temporarily unreachable and may have crashed. Refresh again in 30 seconds or contact system administrator.";
  el.classList.remove("hidden");
}

function hideCrmCrashBanner() {
  const el = $("#crm-crash-banner");
  if (el) el.classList.add("hidden");
}

function showSubmittingNote(button, message = 'Submitting — do not press the button again') {
  if (!button || !button.parentNode) return null;
  // Remove any previous note
  const prev = button.parentNode.querySelector('.submitting-note');
  if (prev) prev.remove();
  const note = document.createElement('div');
  note.className = 'submitting-note';
  note.textContent = message;
  note.style.cssText = 'color: #f59e0b; font-size: 0.75em; margin-top: 4px;';
  button.parentNode.insertBefore(note, button.nextSibling);
  return note;
}

/**
 * Thin wrapper used to make specific CRM mutators queue on transient failure.
 * Returns {queued: true} on transient (caller can early-return), otherwise the result of mutateFn.
 * Hard errors are re-thrown unchanged (preserves all existing modal/global error UX).
 */
async function withCrmQueueOnTransient(mutateFn, descriptor) {
  const desc = descriptor.description || 'action';
  try {
    const result = await mutateFn();
    onCRMSuccess();
    // Form submit handlers fully control the progress bar sequence (Connecting -> Connected & Syncing -> success).
    // Non-form/inline actions rely on showToast for feedback instead of the bar.
    // (Removed auto "sent successfully" here to prevent overlapping/reappearing messages on the bar after forms take over.)
    return result;
  } catch (err) {
    if (isTransientError(err)) {
      enqueueCrmMutation(descriptor);
      startConnectingGrace(descriptor);
      return { queued: true };
    }
    hideCRMSyncStatus();
    throw err;
  }
}

function newGroup(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: "New group",
    dealStatus: "open",
    tagTitles: [],
    contactId: "",
    contactLabel: "",
    stageId: "",
    stageType: "",
    search: "",
    groupBy: "stage",
    sortBy: "stage",
    sortOrder: "ascending",
    filtersCollapsed: false,
    visibleStageIds: [],
    stageColumnsConfigured: false,
    showEmptyStages: true,
    showOnlyRedOpportunities: false,
    stageColors: {},
    opportunities: [],
    ...overrides,
  };
}

function ensureVisibleStageIds(group) {
  if (!Array.isArray(group.visibleStageIds)) group.visibleStageIds = [];
  if (!group.stageColumnsConfigured && state.stages.length) {
    group.visibleStageIds = state.stages.map((s) => String(s.id));
  }
}

function isStageColumnVisible(group, stageId) {
  if (!group.stageColumnsConfigured) return true;
  return (group.visibleStageIds || []).includes(String(stageId));
}

function getOpportunityContactLabel(opp) {
  const contact = opp.contact || opp.Contact;
  if (contact && typeof contact === "object") {
    return (
      contact.displayName ||
      contact.DisplayName ||
      contact.title ||
      contact.Title ||
      contact.company ||
      ""
    ).trim();
  }
  return String(contact || opp.contactTitle || opp.ContactTitle || "").trim();
}

function loadGroupsFromStorage() {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((g) => stripGroupRuntimeFields(g));
      }
    }
  } catch {
    /* ignore */
  }
  return [
    newGroup({ name: "Open pipeline", dealStatus: "open", groupBy: "stage" }),
    newGroup({ name: "Tagged deals", dealStatus: "all", groupBy: "tag", tagTitles: [] }),
  ];
}

function saveGroupsToStorage() {
  const slim = state.groups.map((g) => {
    const { opportunities, ...rest } = stripGroupRuntimeFields(g);
    return rest;
  });
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

function stripCalendarRuntimeFields(cal) {
  const { _el, _loading, ...rest } = cal;
  return rest;
}

function newCalendarTile(overrides = {}) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: "Calendar",
    feedUrl: "",
    timezone: "",
    viewYear: now.getFullYear(),
    viewMonth: now.getMonth() + 1,
    ...overrides,
  };
}

const CALENDAR_TZ_COMMON = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Panama",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

const CALENDAR_TZ_FALLBACK = [
  ...CALENDAR_TZ_COMMON,
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Boise",
  "America/Vancouver",
  "Europe/Berlin",
  "Australia/Sydney",
];

let calendarTimezoneOptionsCache = null;

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function resolveCalendarTimezone(cal) {
  if (cal?.timezone) return cal.timezone;
  const tid = cal ? calendarTileId(cal) : "";
  const fromCache = tid ? state.calendarCache[tid]?.timezone : "";
  if (fromCache) return fromCache;
  return getBrowserTimezone();
}

function getCalendarTimezoneOptionList() {
  if (calendarTimezoneOptionsCache) return calendarTimezoneOptionsCache;
  let all = [];
  try {
    if (typeof Intl !== "undefined" && Intl.supportedValuesOf) {
      all = Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  if (!all.length) all = [...CALENDAR_TZ_FALLBACK];
  const commonSet = new Set(CALENDAR_TZ_COMMON);
  const rest = all.filter((tz) => !commonSet.has(tz)).sort((a, b) => a.localeCompare(b));
  calendarTimezoneOptionsCache = { common: [...CALENDAR_TZ_COMMON], rest };
  return calendarTimezoneOptionsCache;
}

function formatTimezoneLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value;
    const label = tz.replace(/_/g, " ");
    return abbr ? `${label} (${abbr})` : label;
  } catch {
    return tz.replace(/_/g, " ");
  }
}

function populateCalendarTimezoneSelect(select, selectedTz) {
  if (!select) return;
  const { common, rest } = getCalendarTimezoneOptionList();
  const selected = selectedTz || getBrowserTimezone();
  select.innerHTML = "";

  const addGroup = (label, zones) => {
    const og = document.createElement("optgroup");
    og.label = label;
    for (const tz of zones) {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = formatTimezoneLabel(tz);
      if (tz === selected) opt.selected = true;
      og.appendChild(opt);
    }
    select.appendChild(og);
  };

  addGroup("Common", common);
  addGroup("All timezones", rest);
  if (![...common, ...rest].includes(selected)) {
    const opt = document.createElement("option");
    opt.value = selected;
    opt.textContent = formatTimezoneLabel(selected);
    opt.selected = true;
    select.insertBefore(opt, select.firstChild);
  }
}

function getZonedParts(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (type) => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function wallTimeInZoneToUtc(year, month, day, hour, minute, timeZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 6; i++) {
    const p = getZonedParts(utc, timeZone);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const delta = target - actual;
    if (Math.abs(delta) < 1000) break;
    utc += delta;
  }
  return utc;
}

function eventStartUtcMs(ev) {
  const s = ev?.start;
  if (!s || s.allDay) return null;
  if (s.iso && String(s.iso).endsWith("Z")) return new Date(s.iso).getTime();
  return wallTimeInZoneToUtc(
    s.year,
    s.month,
    s.day,
    s.hour ?? 0,
    s.minute ?? 0,
    s.tzid || "UTC"
  );
}

function eventEndUtcMs(ev) {
  const e = ev?.end || ev?.start;
  if (!e || e.allDay) return null;
  if (e.iso && String(e.iso).endsWith("Z")) return new Date(e.iso).getTime();
  return wallTimeInZoneToUtc(
    e.year,
    e.month,
    e.day,
    e.hour ?? 0,
    e.minute ?? 0,
    e.tzid || ev?.start?.tzid || "UTC"
  );
}

function allDayRangeFloating(ev) {
  const start = eventDateParts(ev.start);
  if (!start || start.y == null) return null;
  const end = eventDateParts(ev.end) || start;
  let ey = end.y ?? start.y;
  let em = end.m ?? start.m;
  let ed = end.d ?? start.d;
  if (ev.end?.allDay && ev.start?.allDay) {
    const endMs = Date.UTC(ey, em - 1, ed);
    const adj = new Date(endMs - 86400000);
    ey = adj.getUTCFullYear();
    em = adj.getUTCMonth() + 1;
    ed = adj.getUTCDate();
  }
  return { start, end: { y: ey, m: em, d: ed } };
}

function todayYmdInTimezone(timeZone) {
  return getZonedParts(Date.now(), timeZone);
}

function loadCalendarsFromStorage() {
  try {
    const raw = localStorage.getItem(CALENDARS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => stripCalendarRuntimeFields(c));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveCalendarsToStorage() {
  const slim = state.calendarTiles.map((c) => stripCalendarRuntimeFields(c));
  localStorage.setItem(CALENDARS_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

const CALENDAR_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function calendarViewMonthLabel(cal) {
  const m = CALENDAR_MONTH_NAMES[(cal.viewMonth || 1) - 1] || "";
  return `${m} ${cal.viewYear || ""}`.trim();
}

function shiftCalendarViewMonth(cal, delta) {
  let y = cal.viewYear || new Date().getFullYear();
  let m = cal.viewMonth || new Date().getMonth() + 1;
  m += delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  cal.viewYear = y;
  cal.viewMonth = m;
  saveCalendarsToStorage();
}

function eventDateParts(dt) {
  if (!dt) return null;
  return { y: dt.year, m: dt.month, d: dt.day };
}

function eventOnCalendarDay(ev, year, month, day, timeZone) {
  if (ev.start?.allDay) {
    const range = allDayRangeFloating(ev);
    if (!range) return false;
    const cell = Date.UTC(year, month - 1, day);
    const s = Date.UTC(range.start.y, range.start.m - 1, range.start.d);
    const e = Date.UTC(range.end.y, range.end.m - 1, range.end.d);
    return cell >= s && cell <= e;
  }
  const startMs = eventStartUtcMs(ev);
  if (!Number.isFinite(startMs)) return false;
  let endMs = eventEndUtcMs(ev);
  if (!Number.isFinite(endMs)) endMs = startMs + 3600000;
  const dayStart = wallTimeInZoneToUtc(year, month, day, 0, 0, timeZone);
  const dayEnd = wallTimeInZoneToUtc(year, month, day, 23, 59, timeZone) + 60000;
  return startMs < dayEnd && endMs >= dayStart;
}

function eventSortKeyInTimezone(ev, timeZone) {
  if (ev.start?.allDay) return 0;
  const ms = eventStartUtcMs(ev);
  if (!Number.isFinite(ms)) return 0;
  const p = getZonedParts(ms, timeZone);
  return p.hour * 60 + p.minute;
}

function formatEventTimeInTimezone(ev, timeZone) {
  if (ev.start?.allDay) return "";
  const ms = eventStartUtcMs(ev);
  if (!Number.isFinite(ms)) return "";
  const p = getZonedParts(ms, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} `;
}

function eventsForCalendarDay(events, year, month, day, timeZone) {
  return events
    .filter((ev) => ev.status !== "CANCELLED" && eventOnCalendarDay(ev, year, month, day, timeZone))
    .sort((a, b) => {
      const sa = eventSortKeyInTimezone(a, timeZone);
      const sb = eventSortKeyInTimezone(b, timeZone);
      if (sa !== sb) return sa - sb;
      return String(a.summary || "").localeCompare(String(b.summary || ""));
    });
}

function buildCalendarMonthGrid(year, month) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    cells.push({ year: py, month: pm, day: d, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    let ny = last.year;
    let nm = last.month;
    let nd = last.day + 1;
    if (nd > new Date(ny, nm, 0).getDate()) {
      nd = 1;
      nm += 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
    }
    cells.push({ year: ny, month: nm, day: nd, outside: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    let ny = last.year;
    let nm = last.month;
    let nd = last.day + 1;
    if (nd > new Date(ny, nm, 0).getDate()) {
      nd = 1;
      nm += 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
    }
    cells.push({ year: ny, month: nm, day: nd, outside: true });
  }
  return cells;
}

function renderCalendarMonthBody(section, cal) {
  const body = $(".calendar-month-body", section);
  if (!body) return;
  const tid = calendarTileId(cal);
  if (tileBodyCollapsed(tid)) {
    body.innerHTML = '<p class="tile-collapsed-hint">Minimized — expand to load calendar</p>';
    return;
  }
  const cache = state.calendarCache[tid];
  const events = cache?.events || [];
  const y = cal.viewYear || new Date().getFullYear();
  const m = cal.viewMonth || new Date().getMonth() + 1;
  const tz = resolveCalendarTimezone(cal);
  const today = todayYmdInTimezone(tz);
  const cells = buildCalendarMonthGrid(y, m);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = '<div class="calendar-month-grid" role="grid" aria-label="Monthly calendar">';
  html += '<div class="calendar-weekdays" role="row">';
  for (const wd of weekdays) {
    html += `<div class="calendar-weekday" role="columnheader">${escapeHtml(wd)}</div>`;
  }
  html += '</div><div class="calendar-days" role="rowgroup">';

  for (const cell of cells) {
    const isToday =
      cell.year === today.year && cell.month === today.month && cell.day === today.day;
    const dayEvents = eventsForCalendarDay(events, cell.year, cell.month, cell.day, tz);
    const cls = [
      "calendar-day",
      cell.outside ? "calendar-day-outside" : "",
      isToday ? "calendar-day-today" : "",
    ]
      .filter(Boolean)
      .join(" ");
    html += `<div class="${cls}" role="gridcell" data-date="${cell.year}-${String(cell.month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}">`;
    html += `<div class="calendar-day-num">${cell.day}</div>`;
    html += '<div class="calendar-day-events">';
    const maxShow = 3;
    for (let i = 0; i < Math.min(dayEvents.length, maxShow); i++) {
      const ev = dayEvents[i];
      const color = ev.color || "#6e4bdb";
      const time = formatEventTimeInTimezone(ev, tz);
      const uidAttr = escapeHtml(ev.uid || "");
      html += `<button type="button" class="calendar-event-chip" data-event-uid="${uidAttr}" style="--event-color:${escapeHtml(color)}" title="${escapeHtml((time + ev.summary).trim())}">`;
      html += `<span class="calendar-event-dot" aria-hidden="true"></span>`;
      html += `<span class="calendar-event-label">${escapeHtml(time + (ev.summary || ""))}</span>`;
      html += "</button>";
    }
    if (dayEvents.length > maxShow) {
      html += `<div class="calendar-more-events">+${dayEvents.length - maxShow} more</div>`;
    }
    html += "</div></div>";
  }
  html += "</div></div>";
  body.innerHTML = html;

  const monthLabel = $(".calendar-month-label", section);
  if (monthLabel) monthLabel.textContent = calendarViewMonthLabel(cal);
  const countEl = $(".calendar-tile-count", section);
  if (countEl) {
    const inMonth = events.filter((ev) => {
      if (ev.status === "CANCELLED") return false;
      for (const cell of cells) {
        if (!cell.outside && eventOnCalendarDay(ev, cell.year, cell.month, cell.day, tz)) return true;
      }
      return false;
    }).length;
    countEl.textContent = `${inMonth} events`;
  }

  bindCalendarEventClicks(section, cal);
}

function findCalendarEventByUid(cal, uid) {
  if (!uid) return null;
  const tid = calendarTileId(cal);
  const events = state.calendarCache[tid]?.events || [];
  return events.find((ev) => ev.uid === uid) || null;
}

function formatCalendarEventWhen(ev, timeZone) {
  const pad = (n) => String(n).padStart(2, "0");
  if (ev.start?.allDay) {
    const s = ev.start;
    const range = allDayRangeFloating(ev);
    const startLabel = `${s.year}-${pad(s.month)}-${pad(s.day)}`;
    if (range && (range.end.y !== s.year || range.end.m !== s.month || range.end.d !== s.day)) {
      return `All day · ${startLabel} – ${range.end.y}-${pad(range.end.m)}-${pad(range.end.d)}`;
    }
    return `All day · ${startLabel}`;
  }
  const startMs = eventStartUtcMs(ev);
  if (!Number.isFinite(startMs)) return "";
  const sp = getZonedParts(startMs, timeZone);
  let label = `${sp.year}-${pad(sp.month)}-${pad(sp.day)} ${pad(sp.hour)}:${pad(sp.minute)}`;
  const endMs = eventEndUtcMs(ev);
  if (Number.isFinite(endMs) && endMs > startMs) {
    const ep = getZonedParts(endMs, timeZone);
    label += ` – ${ep.year}-${pad(ep.month)}-${pad(ep.day)} ${pad(ep.hour)}:${pad(ep.minute)}`;
  }
  return label;
}

function openCalendarEventModal(ev, cal) {
  const modal = $("#calendar-event-modal");
  const titleEl = $("#calendar-event-modal-title");
  const bodyEl = $("#calendar-event-modal-body");
  if (!modal || !titleEl || !bodyEl) return;

  const tz = resolveCalendarTimezone(cal);
  const color = ev.color || "#6e4bdb";
  titleEl.innerHTML = `<span class="calendar-event-modal-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(ev.summary || "Event")}`;

  const rows = [];
  const when = formatCalendarEventWhen(ev, tz);
  if (when) rows.push({ label: "When", value: when });
  if (ev.status && ev.status !== "CONFIRMED") rows.push({ label: "Status", value: ev.status });
  if (ev.organizer) rows.push({ label: "Organizer", value: ev.organizer });
  if (ev.location) {
    const loc = ev.location;
    if (/^https?:\/\//i.test(loc)) {
      rows.push({
        label: "Location",
        html: `<a href="${escapeHtml(loc)}" target="_blank" rel="noopener noreferrer">${escapeHtml(loc)}</a>`,
      });
    } else {
      rows.push({ label: "Location", value: loc });
    }
  }
  if (ev.url) {
    rows.push({
      label: "Link",
      html: `<a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.url)}</a>`,
    });
  }
  const calName = state.calendarCache[calendarTileId(cal)]?.name;
  if (calName) rows.push({ label: "Calendar", value: calName });
  if (ev.categories?.length) rows.push({ label: "Categories", value: ev.categories.join(", ") });
  if (ev.recurrence || ev.rrule) {
    rows.push({ label: "Repeats", value: ev.recurrence || ev.rrule });
  }
  if (ev.attendees?.length) {
    const list = ev.attendees
      .map((a) => escapeHtml(a.label || a.name || a.email || ""))
      .filter(Boolean)
      .join("<br/>");
    if (list) {
      rows.push({ label: "Attendees", html: `<div class="calendar-event-attendees">${list}</div>` });
    }
  }
  if (ev.transparency) {
    const t = String(ev.transparency).toUpperCase();
    rows.push({
      label: "Show as",
      value: t === "TRANSPARENT" ? "Free" : t === "OPAQUE" ? "Busy" : ev.transparency,
    });
  }
  if (ev.visibility) rows.push({ label: "Visibility", value: ev.visibility });
  if (ev.priority != null && ev.priority !== "") {
    rows.push({ label: "Priority", value: String(ev.priority) });
  }
  if (ev.geo) rows.push({ label: "Location (coordinates)", value: ev.geo });
  if (ev.created) rows.push({ label: "Created", value: ev.created });
  if (ev.lastModified) rows.push({ label: "Modified", value: ev.lastModified });
  if (ev.dtstamp && ev.dtstamp !== ev.lastModified) rows.push({ label: "Stamp", value: ev.dtstamp });
  if (ev.sequence != null && ev.sequence !== "") rows.push({ label: "Sequence", value: String(ev.sequence) });

  let bodyHtml = "";
  for (const row of rows) {
    bodyHtml += `<div class="calendar-event-detail-row"><span class="calendar-event-detail-label">${escapeHtml(row.label)}</span>`;
    if (row.html) bodyHtml += `<div class="calendar-event-detail-value">${row.html}</div>`;
    else bodyHtml += `<div class="calendar-event-detail-value">${escapeHtml(row.value)}</div>`;
    bodyHtml += "</div>";
  }
  if (ev.description) {
    bodyHtml += `<div class="calendar-event-detail-row calendar-event-detail-description"><span class="calendar-event-detail-label">Description</span>`;
    bodyHtml += `<div class="calendar-event-detail-value calendar-event-detail-desc-text">${escapeHtml(ev.description)}</div></div>`;
  }
  if (!bodyHtml) bodyHtml = '<p class="calendar-event-detail-empty">No additional details.</p>';
  if (ev.uid) {
    bodyHtml += `<p class="calendar-event-detail-uid" title="Event UID">${escapeHtml(ev.uid)}</p>`;
  }
  bodyEl.innerHTML = bodyHtml;
  modal.classList.remove("hidden");
}

function closeCalendarEventModal() {
  $("#calendar-event-modal")?.classList.add("hidden");
}

function bindCalendarEventClicks(section, cal) {
  if (!section || section.dataset.calendarEventsBound) return;
  section.dataset.calendarEventsBound = "1";
  section.addEventListener("click", (e) => {
    const chip = e.target.closest(".calendar-event-chip");
    if (!chip) return;
    e.stopPropagation();
    const uid = chip.dataset.eventUid;
    const ev = findCalendarEventByUid(cal, uid);
    if (ev) openCalendarEventModal(ev, cal);
  });
}

function bindCalendarEventModal() {
  const modal = $("#calendar-event-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#calendar-event-modal-close")?.addEventListener("click", closeCalendarEventModal);
  modal.querySelectorAll("[data-calendar-event-dismiss]").forEach((el) => {
    el.addEventListener("click", closeCalendarEventModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCalendarEventModal();
  });
}

async function fetchCalendarFeed(feedUrl) {
  const q = new URLSearchParams({ url: feedUrl }).toString();
  const res = await fetch(`/api/calendar/feed?${q}`, { credentials: "same-origin" });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    const snippet = text.slice(0, 300) || res.statusText;
    if (res.status === 404 && /<!DOCTYPE/i.test(text)) {
      throw new Error(
        "Calendar API not found. Restart the dashboard server (./start.sh) so it loads the latest server.py."
      );
    }
    throw new Error(res.ok ? "Invalid JSON from server" : snippet);
  }
  if (!res.ok) throw new Error(parseApiError(body, res.status));
  return body;
}

async function loadCalendarForTile(cal, { quiet = false } = {}) {
  const tid = calendarTileId(cal);
  if (tileBodyCollapsed(tid)) {
    showTileCollapsedHint(tid, "Minimized — expand to load calendar");
    return;
  }
  const section = cal._el;
  if (section) section.classList.toggle("calendar-loading", true);
  try {
    const data = await fetchCalendarFeed(cal.feedUrl);
    state.calendarCache[tid] = {
      name: data.name,
      timezone: data.timezone,
      events: Array.isArray(data.events) ? data.events : [],
      fetchedAt: Date.now(),
    };
    if (data.name && (!cal.name || cal.name === "Calendar")) {
      cal.name = data.name;
      saveCalendarsToStorage();
      const nameInput = section?.querySelector(".calendar-tile-name");
      if (nameInput) nameInput.value = cal.name;
      if (section) section.dataset.tileLabel = cal.name;
    }
    if (!cal.timezone && data.timezone) {
      cal.timezone = data.timezone;
      saveCalendarsToStorage();
    }
    const tzSelect = section?.querySelector(".calendar-tz-select");
    if (tzSelect) {
      populateCalendarTimezoneSelect(tzSelect, resolveCalendarTimezone(cal));
    }
    if (section) renderCalendarMonthBody(section, cal);
  } catch (err) {
    if (!quiet) showToast(err.message, true);
    const body = section?.querySelector(".calendar-month-body");
    if (body) {
      body.innerHTML = `<p class="calendar-error">${escapeHtml(err.message || "Could not load calendar")}</p>`;
    }
    throw err;
  } finally {
    if (section) section.classList.remove("calendar-loading");
  }
}

function bindCalendarTileChrome(section, cal, tileId) {
  if (section.querySelector(":scope > .group-tile-bar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar group-tile-bar calendar-tile-bar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");
  hint.title = "Drag to reorder (left/right or up/down)";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "group-tile-name calendar-tile-name";
  nameInput.placeholder = "Calendar label";
  nameInput.value = cal.name || "";
  nameInput.setAttribute("aria-label", "Calendar label");

  const countEl = document.createElement("span");
  countEl.className = "group-tile-count calendar-tile-count";
  countEl.textContent = "0 events";

  const nav = document.createElement("div");
  nav.className = "calendar-month-nav";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-ghost btn-calendar-nav";
  prevBtn.textContent = "‹";
  prevBtn.title = "Previous month";
  const monthLabel = document.createElement("span");
  monthLabel.className = "calendar-month-label";
  monthLabel.textContent = calendarViewMonthLabel(cal);
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-ghost btn-calendar-nav";
  nextBtn.textContent = "›";
  nextBtn.title = "Next month";
  nav.appendChild(prevBtn);
  nav.appendChild(monthLabel);
  nav.appendChild(nextBtn);

  const tzWrap = document.createElement("label");
  tzWrap.className = "calendar-tz-label";
  const tzSelect = document.createElement("select");
  tzSelect.className = "calendar-tz-select";
  tzSelect.title = "Display timezone";
  tzSelect.setAttribute("aria-label", "Calendar timezone");
  populateCalendarTimezoneSelect(tzSelect, resolveCalendarTimezone(cal));
  tzWrap.appendChild(tzSelect);

  const removeBtn = createTileRemoveButton("Remove this calendar tile from the dashboard", "btn-remove-calendar");

  const { wrap, halfBtn, fullBtn, tallBtn } = createLayoutButtons();

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(countEl);
  toolbar.appendChild(nav);
  toolbar.appendChild(tzWrap);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);
  ensureTileAutoRefreshButton(section, tileId);

  const syncMonth = () => {
    monthLabel.textContent = calendarViewMonthLabel(cal);
    renderCalendarMonthBody(section, cal);
  };

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shiftCalendarViewMonth(cal, -1);
    syncMonth();
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shiftCalendarViewMonth(cal, 1);
    syncMonth();
  });

  tzSelect.addEventListener("click", (e) => e.stopPropagation());
  tzSelect.addEventListener("change", (e) => {
    e.stopPropagation();
    cal.timezone = tzSelect.value;
    saveCalendarsToStorage();
    renderCalendarMonthBody(section, cal);
  });

  nameInput.addEventListener("input", () => {
    cal.name = nameInput.value;
    section.dataset.tileLabel = cal.name || "Calendar";
    saveCalendarsToStorage();
  });
  nameInput.addEventListener("change", () => {
    cal.name = nameInput.value.trim() || "Calendar";
    nameInput.value = cal.name;
    section.dataset.tileLabel = cal.name;
    saveCalendarsToStorage();
  });

  removeBtn.addEventListener("click", async () => {
    const label = cal.name?.trim() || "this calendar";
    const ok = await confirmDialog({
      title: "Remove calendar tile?",
      message: `Remove “${label}” from the dashboard?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    const tid = calendarTileId(cal);
    state.calendarTiles = state.calendarTiles.filter((c) => c.id !== cal.id);
    delete state.calendarCache[tid];
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    saveCalendarsToStorage();
    saveLayoutToStorage();
    renderBoardGroups();
  });
}

function renderCalendarTiles(dash) {
  for (const cal of state.calendarTiles) {
    const tileId = calendarTileId(cal);
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile calendar-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = cal.name || "Calendar";
    section.dataset.calendarId = cal.id;
    section.innerHTML = `<div class="calendar-month-body"><p class="calendar-loading-hint">Loading calendar…</p></div>`;
    dash.appendChild(section);
    bindCalendarTileChrome(section, cal, tileId);
    cal._el = section;
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
    const tid = calendarTileId(cal);
    if (tileBodyCollapsed(tileId)) {
      const body = section.querySelector(".calendar-month-body");
      if (body) {
        body.innerHTML =
          '<p class="tile-collapsed-hint">Minimized — expand to load calendar</p>';
      }
    } else if (state.calendarCache[tid]) {
      renderCalendarMonthBody(section, cal);
    } else {
      const body = section.querySelector(".calendar-month-body");
      if (body) body.innerHTML = '<p class="calendar-loading-hint">Loading calendar…</p>';
    }
  }
}

function stripNotesRuntimeFields(notes) {
  const { _el, _saveTimer, ...rest } = notes;
  return rest;
}

/** Fallback when CRM opportunity user-field definitions are not loaded yet. */
const CHECKLIST_FIELD_NAMES_FALLBACK = [
  "Measurement Report",
  "Insurance Documents",
  "Inspection Photos",
];

/** Checkbox user fields used for the “Missing Checklist info” card warning and Claim checklist preset. */
function opportunityChecklistFieldLabels() {
  if (!state.customFieldDefs.length) return [...CHECKLIST_FIELD_NAMES_FALLBACK];

  const defs = state.customFieldDefs;
  let inChecklistSection = false;
  const sectionLabels = [];

  for (const def of defs) {
    const label = customFieldLabel(def);
    const code = customFieldTypeCode(def);
    if (code === 4) {
      const key = normalizeUserFieldLabelKey(label);
      if (key.includes("checklist") || key.includes("claim")) {
        inChecklistSection = true;
        continue;
      }
      if (inChecklistSection) break;
      continue;
    }
    if (inChecklistSection && code === 3 && !isCreateOppExcludedUserField(def) && label) {
      sectionLabels.push(label);
    }
  }
  if (sectionLabels.length) return sectionLabels;

  const matched = [];
  for (const def of defs) {
    if (customFieldTypeCode(def) !== 3) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    const label = customFieldLabel(def);
    if (!label) continue;
    if (CHECKLIST_FIELD_NAMES_FALLBACK.some((name) => fieldNameMatches(label, [name]))) {
      matched.push(label);
    }
  }
  if (matched.length) return matched;

  const checkboxes = [];
  for (const def of defs) {
    if (customFieldTypeCode(def) !== 3) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    const label = customFieldLabel(def);
    if (label) checkboxes.push(label);
  }
  return checkboxes.length ? checkboxes : [...CHECKLIST_FIELD_NAMES_FALLBACK];
}

function notesClaimChecklistContent() {
  const lines = opportunityChecklistFieldLabels().map((label) => `- [ ] ${label}`);
  return `## Claim checklist\n\n${lines.join("\n")}\n`;
}

const NOTES_ADD_PRESETS = [
  { id: "blank", label: "Blank notes", name: "Notes", content: "" },
  { id: "daily", label: "Daily", name: "Daily", content: "## Today\n\n- [ ] \n" },
  { id: "followups", label: "Follow-ups", name: "Follow-ups", content: "## Follow-ups\n\n- [ ] \n" },
  { id: "week", label: "This week", name: "This week", content: "## This week\n\n- [ ] \n" },
  { id: "checklist", label: "Claim checklist", name: "Claim checklist", content: null },
];

function notesPresetContent(preset) {
  if (!preset) return "";
  if (preset.id === "checklist") return notesClaimChecklistContent();
  return preset.content || "";
}

const NOTES_ACCENT_OPTIONS = [
  { value: "", label: "No accent" },
  { value: "#5b8def", label: "Blue" },
  { value: "#3d9a6a", label: "Green" },
  { value: "#c9a227", label: "Gold" },
  { value: "#c45c5c", label: "Red" },
  { value: "#9b7ed9", label: "Purple" },
];

function newNotesTile(overrides = {}) {
  const base = {
    id: crypto.randomUUID(),
    name: "Notes",
    content: "",
    viewMode: "edit",
    defaultViewMode: null,
    accent: "",
    updatedAt: null,
  };
  const merged = { ...base, ...overrides };
  if (merged.defaultViewMode !== "preview" && merged.defaultViewMode !== "edit") {
    merged.defaultViewMode = null;
  }
  return merged;
}

function newLocalKanbanTile(overrides = {}) {
  const base = {
    id: crypto.randomUUID(),
    name: "My Kanban",
    columns: [
      { id: crypto.randomUUID(), title: "To Do", cards: [] },
      { id: crypto.randomUUID(), title: "In Progress", cards: [] },
      { id: crypto.randomUUID(), title: "Done", cards: [] },
    ],
    archived: false,
    updatedAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

function activeNotesTiles() {
  return state.notesTiles.filter((n) => !n.archived);
}

function archivedNotesTiles() {
  return state.notesTiles.filter((n) => n.archived);
}

async function archiveNotesTile(notes) {
  const label = notes.name?.trim() || "this notes tile";
  const ok = await confirmDialog({
    title: "Archive notes tile?",
    message: `Archive “${label}”? It will be hidden from the dashboard. Restore its text later from File → Restore from archive on any notes tile.`,
    confirmLabel: "Archive",
    danger: false,
  });
  if (!ok) return;
  notes.archived = true;
  notes.archivedAt = new Date().toISOString();
  touchNotesTile(notes);
  const tid = notesTileId(notes);
  state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
  delete state.tileLayout.widths[tid];
  delete state.tileLayout.heights[tid];
  delete state.tileLayout.collapsed?.[tid];
  saveLayoutToStorage();
  scheduleUserProfileSave();
  renderBoardGroups();
  showToast("Notes tile archived");
}

function applyArchivedNotesContentToTile(targetNotes, archived) {
  if (!targetNotes || !archived) return;
  targetNotes.content = archived.content || "";
  touchNotesTile(targetNotes);
  scheduleNotesTileSave(targetNotes);
  if (targetNotes._el) {
    syncNotesTileBody(targetNotes._el, targetNotes);
  }
  showToast(`Loaded archive from “${archived.name?.trim() || "Notes"}”`);
}

function openNotesRestoreFromArchiveModal(targetNotes) {
  const modal = $("#notes-archive-restore-modal");
  const list = $("#notes-archive-restore-list");
  if (!modal || !list) return;

  const archived = archivedNotesTiles().sort((a, b) => {
    const ta = new Date(a.archivedAt || 0).getTime();
    const tb = new Date(b.archivedAt || 0).getTime();
    return tb - ta;
  });

  list.innerHTML = "";
  if (!archived.length) {
    list.innerHTML = `<li class="notes-archive-restore-empty">No archived notes yet. Use File → Archive to save a tile to the archive.</li>`;
  } else {
    for (const entry of archived) {
      const li = document.createElement("li");
      li.className = "notes-archive-restore-item";
      const meta = document.createElement("button");
      meta.type = "button";
      meta.className = "notes-archive-restore-pick";
      const title = entry.name?.trim() || "Notes";
      const when = entry.archivedAt ? new Date(entry.archivedAt).toLocaleString() : "Unknown date";
      meta.innerHTML = `<span class="notes-archive-restore-name">${escapeHtml(title)}</span><span class="notes-archive-restore-date">${escapeHtml(when)}</span>`;
      meta.addEventListener("click", () => {
        applyArchivedNotesContentToTile(targetNotes, entry);
        closeNotesRestoreFromArchiveModal();
      });
      li.appendChild(meta);
      list.appendChild(li);
    }
  }

  modal.classList.remove("hidden");
  modal.dataset.targetNotesId = targetNotes.id;
}

function closeNotesRestoreFromArchiveModal() {
  const modal = $("#notes-archive-restore-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  delete modal.dataset.targetNotesId;
}

function bindNotesArchiveRestoreModal() {
  const modal = $("#notes-archive-restore-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#notes-archive-restore-close")?.addEventListener("click", closeNotesRestoreFromArchiveModal);
  modal.querySelectorAll("[data-notes-archive-dismiss]").forEach((el) => {
    el.addEventListener("click", closeNotesRestoreFromArchiveModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeNotesRestoreFromArchiveModal();
    }
  });
}

function applyNotesDefaultViewOnLoad(notes) {
  if (notes.defaultViewMode === "preview") notes.viewMode = "preview";
  else if (notes.defaultViewMode === "edit") notes.viewMode = "edit";
}

function notesFilenameSafe(name) {
  return (
    String(name || "notes")
      .trim()
      .replace(/[^\w.\- ]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "notes"
  );
}

function notesTextStats(text) {
  const s = String(text || "");
  const words = s.trim() ? s.trim().split(/\s+/).length : 0;
  return { chars: s.length, words };
}

function formatNotesDateStamp() {
  const d = new Date();
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

function formatNotesUpdatedLabel(iso) {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function syncNotesUpdatedFooter(section, notes) {
  if (!section) return;
  const footer = $(".notes-tile-footer", section);
  const label = $(".notes-updated-label", section);
  const statsEl = $(".notes-stats-label", section);
  if (!footer || !label) return;
  const text = formatNotesUpdatedLabel(notes.updatedAt);
  label.textContent = text ? `Last updated ${text}` : "Not saved yet";
  footer.title = text ? `Last saved to server: ${text}` : "Saves automatically to the server";
  if (statsEl) {
    const { words, chars } = notesTextStats(notes.content);
    statsEl.textContent = `${words} words · ${chars} characters`;
  }
}

function touchNotesTile(notes) {
  notes.updatedAt = new Date().toISOString();
  syncNotesUpdatedFooter(notes._el, notes);
}

function buildUserProfilePayload() {
  const slimGroups = state.groups.map((g) => {
    const { opportunities, ...rest } = stripGroupRuntimeFields(g);
    return rest;
  });
  return {
    updatedAt: new Date().toISOString(),
    groups: slimGroups,
    tileLayout: state.tileLayout,
    calendarTiles: state.calendarTiles.map((c) => stripCalendarRuntimeFields(c)),
    notesTiles: state.notesTiles.map((n) => stripNotesRuntimeFields(n)),
    localKanbanTiles: (state.localKanbanTiles || []).map((k) => stripLocalKanbanRuntimeFields(k)),
    groupTemplates: state.groupTemplates,
    hiddenFeedKeys: serializeHiddenFeedEntries(),
    feedKeywordFilter: state.feedKeywordFilter || "",
    bookmarkedDeals: state.bookmarkedDeals.map((d) => stripBookmarkedRuntimeFields(d)),
  };
}

function applyUserProfile(profile) {
  if (!profile || typeof profile !== "object") return;

  const groups = Array.isArray(profile.groups) ? profile.groups : [];
  state.groups = groups.length
    ? groups.map((g) => ({ ...newGroup(), ...stripGroupRuntimeFields(g), opportunities: [] }))
    : loadGroupsFromStorage().map((g) => ({ ...newGroup(), ...stripGroupRuntimeFields(g), opportunities: [] }));

  const layout = profile.tileLayout;
  if (layout && typeof layout === "object") {
    state.tileLayout = {
      order: Array.isArray(layout.order) ? layout.order : [],
      widths: layout.widths && typeof layout.widths === "object" ? layout.widths : {},
      heights: layout.heights && typeof layout.heights === "object" ? layout.heights : {},
      collapsed: layout.collapsed && typeof layout.collapsed === "object" ? layout.collapsed : {},
      pinned: layout.pinned && typeof layout.pinned === "object" ? layout.pinned : {},
    };
  } else {
    state.tileLayout = loadLayoutFromStorage();
  }

  state.calendarTiles = Array.isArray(profile.calendarTiles)
    ? profile.calendarTiles.map((c) => ({ ...newCalendarTile(), ...stripCalendarRuntimeFields(c) }))
    : [];

  state.notesTiles = Array.isArray(profile.notesTiles)
    ? profile.notesTiles.map((n) => ({ ...newNotesTile(), ...stripNotesRuntimeFields(n) }))
    : loadNotesTilesFromStorage().map((n) => ({ ...newNotesTile(), ...stripNotesRuntimeFields(n) }));

  state.localKanbanTiles = Array.isArray(profile.localKanbanTiles)
    ? profile.localKanbanTiles.map((k) => ({ ...newLocalKanbanTile(), ...stripLocalKanbanRuntimeFields(k) }))
    : loadLocalKanbanTilesFromStorage().map((k) => ({ ...newLocalKanbanTile(), ...stripLocalKanbanRuntimeFields(k) }));

  state.groupTemplates = Array.isArray(profile.groupTemplates) ? profile.groupTemplates : [];

  // Bookmarked deals
  if (Array.isArray(profile.bookmarkedDeals)) {
    state.bookmarkedDeals = profile.bookmarkedDeals.map((d) => ({
      oppId: Number(d.oppId),
      title: String(d.title || ""),
      addedAt: String(d.addedAt || new Date().toISOString()),
    })).filter((d) => Number.isFinite(d.oppId) && d.oppId > 0);
  } else {
    try {
      const raw = localStorage.getItem(BOOKMARKED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.bookmarkedDeals = parsed.map((d) => ({
            oppId: Number(d.oppId),
            title: String(d.title || ""),
            addedAt: String(d.addedAt || new Date().toISOString()),
          })).filter((d) => Number.isFinite(d.oppId) && d.oppId > 0);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

function persistProfileToLocalStorage() {
  const payload = buildUserProfilePayload();
  localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(payload.groups));
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload.tileLayout));
  localStorage.setItem(CALENDARS_STORAGE_KEY, JSON.stringify(payload.calendarTiles));
  localStorage.setItem(NOTES_TILES_STORAGE_KEY, JSON.stringify(payload.notesTiles));
  localStorage.setItem(LOCAL_KANBAN_TILES_STORAGE_KEY, JSON.stringify(payload.localKanbanTiles || []));
  localStorage.setItem(GROUP_TEMPLATES_STORAGE_KEY, JSON.stringify(payload.groupTemplates));
  localStorage.setItem(HIDDEN_FEED_STORAGE_KEY, JSON.stringify(payload.hiddenFeedKeys));
  localStorage.setItem(FEED_KEYWORD_STORAGE_KEY, payload.feedKeywordFilter);
  localStorage.setItem(BOOKMARKED_STORAGE_KEY, JSON.stringify(payload.bookmarkedDeals || []));
}

function profileHasDashboardData(profile) {
  if (!profile) return false;
  return (
    (Array.isArray(profile.groups) && profile.groups.length > 0) ||
    (Array.isArray(profile.calendarTiles) && profile.calendarTiles.length > 0) ||
    (Array.isArray(profile.notesTiles) && profile.notesTiles.length > 0) ||
    (Array.isArray(profile.tileLayout?.order) && profile.tileLayout.order.length > 0)
  );
}

function loadLocalUserProfileBundle() {
  return {
    groups: loadGroupsFromStorage(),
    tileLayout: loadLayoutFromStorage(),
    calendarTiles: loadCalendarsFromStorage(),
    notesTiles: loadNotesTilesFromStorage(),
    localKanbanTiles: loadLocalKanbanTilesFromStorage(),
    groupTemplates: loadGroupTemplates(),
    hiddenFeedKeys: hiddenFeedEntriesToPayload(loadHiddenFeedEntriesFromStorage()),
    feedKeywordFilter: localStorage.getItem(FEED_KEYWORD_STORAGE_KEY) || "",
    bookmarkedDeals: (() => {
      try {
        const raw = localStorage.getItem(BOOKMARKED_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return [];
    })(),
  };
}

async function loadUserProfileFromServer() {
  userProfileReady = false;
  let serverProfile = null;
  try {
    const headers = { Accept: "application/json" };
    if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;
    const res = await fetch("/api/user-profile", { credentials: "same-origin", headers });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && typeof data === "object") serverProfile = data;
  } catch {
    /* fall back */
  }

  const localBundle = loadLocalUserProfileBundle();

  if (profileHasDashboardData(serverProfile)) {
    applyUserProfile(serverProfile);
    persistProfileToLocalStorage();
  } else if (
    localBundle.groups.length ||
    localBundle.calendarTiles.length ||
    localBundle.notesTiles.length ||
    localBundle.tileLayout?.order?.length
  ) {
    applyUserProfile(localBundle);
    try {
      await saveUserProfileToServer({ quiet: true });
    } catch {
      /* keep local */
    }
    persistProfileToLocalStorage();
  } else {
    applyUserProfile({
      groups: [
        newGroup({ name: "Open pipeline", dealStatus: "open", groupBy: "stage" }),
        newGroup({ name: "Tagged deals", dealStatus: "all", groupBy: "tag", tagTitles: [] }),
      ],
      tileLayout: { order: [], widths: {}, heights: {}, collapsed: {}, pinned: {} },
      calendarTiles: [],
      notesTiles: [],
      localKanbanTiles: [],
      groupTemplates: [],
    });
    persistProfileToLocalStorage();
  }

  if (serverProfile) applyFeedUserPreferences(serverProfile);
  else applyFeedUserPreferences(localBundle);

  userProfileReady = true;
}

async function saveUserProfileToServer({ quiet = false } = {}) {
  if (!userProfileReady) return;
  persistProfileToLocalStorage();
  try {
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;
    const res = await fetch("/api/user-profile", {
      method: "PUT",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(buildUserProfilePayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save dashboard settings");
    if (Array.isArray(data.notesTiles)) {
      const byId = new Map(data.notesTiles.map((t) => [t.id, t]));
      for (const n of state.notesTiles) {
        const saved = byId.get(n.id);
        if (saved?.updatedAt) {
          n.updatedAt = saved.updatedAt;
          syncNotesUpdatedFooter(n._el, n);
        }
      }
    }
  } catch (err) {
    if (!quiet) showToast(err.message, true);
    throw err;
  }
}

function scheduleUserProfileSave() {
  if (!userProfileReady) return;
  if (profileSaveTimer) clearTimeout(profileSaveTimer);
  profileSaveTimer = setTimeout(() => {
    profileSaveTimer = null;
    saveUserProfileToServer({ quiet: true }).catch(() => {});
  }, 800);
}

function loadNotesTilesFromStorage() {
  try {
    const raw = localStorage.getItem(NOTES_TILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => stripNotesRuntimeFields(n));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveNotesTilesToStorage() {
  const slim = state.notesTiles.map((n) => stripNotesRuntimeFields(n));
  localStorage.setItem(NOTES_TILES_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

function stripLocalKanbanRuntimeFields(kanban) {
  const { _el, ...rest } = kanban || {};
  return rest;
}

function loadLocalKanbanTilesFromStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_KANBAN_TILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((k) => stripLocalKanbanRuntimeFields(k));
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveLocalKanbanTilesToStorage() {
  const slim = (state.localKanbanTiles || []).map((k) => stripLocalKanbanRuntimeFields(k));
  localStorage.setItem(LOCAL_KANBAN_TILES_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

function stripBookmarkedRuntimeFields(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const { _cachedData, ...rest } = entry;
  return rest;
}

function saveBookmarkedDealsToStorage() {
  const slim = state.bookmarkedDeals.map((d) => stripBookmarkedRuntimeFields(d));
  localStorage.setItem(BOOKMARKED_STORAGE_KEY, JSON.stringify(slim));
  scheduleUserProfileSave();
}

function renderBasicMarkdown(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let inUl = false;
  let inOl = false;
  let inCheck = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
    if (inCheck) {
      out.push("</ul>");
      inCheck = false;
    }
  };

  const inlineFormat = (raw) => {
    let s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // underline via _text_ (free since italic uses only *)
    s = s.replace(/_([^_]+)_/g, "<u>$1</u>");
    // highlight via ==text== (common in note apps; rendered as <mark>)
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
      const href = escapeHtml(url.trim());
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return escapeHtml(label);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    });
    s = s.replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi,
      (url) =>
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
    );
    return s;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    const compact = trimmed.trim();
    if (!compact) {
      closeLists();
      continue;
    }
    if (/^---+$/.test(compact) || /^\*\*\*+$/.test(compact)) {
      closeLists();
      out.push('<hr class="notes-md-hr" />');
      continue;
    }
    const hm = compact.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      closeLists();
      const level = hm[1].length;
      out.push(`<h${level} class="notes-md-h${level}">${inlineFormat(hm[2])}</h${level}>`);
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      closeLists();
      out.push(`<blockquote class="notes-md-quote">${inlineFormat(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    const checkm = compact.match(/^-\s+\[([ xX])\]\s*(.*)$/);
    if (checkm) {
      if (!inCheck) {
        closeLists();
        out.push('<ul class="notes-md-checklist">');
        inCheck = true;
      }
      const checked = checkm[1].toLowerCase() === "x";
      const body = checkm[2] || "";
      out.push(
        `<li class="notes-md-check-item" data-line="${i}"><label class="notes-md-check-label"><input type="checkbox" class="notes-md-check-input" data-line="${i}"${checked ? " checked" : ""} /><span class="notes-md-check-text">${inlineFormat(body) || "&nbsp;"}</span></label></li>`
      );
      continue;
    }
    const ulm = compact.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      if (!inUl) {
        closeLists();
        out.push('<ul class="notes-md-list">');
        inUl = true;
      }
      out.push(`<li>${inlineFormat(ulm[1])}</li>`);
      continue;
    }
    const olm = compact.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      if (!inOl) {
        closeLists();
        out.push('<ol class="notes-md-list">');
        inOl = true;
      }
      out.push(`<li>${inlineFormat(olm[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${inlineFormat(compact)}</p>`);
  }
  closeLists();
  return out.join("") || '<p class="notes-md-empty">Nothing to preview yet.</p>';
}

function toggleNotesCheckboxLine(notes, lineIndex, checked) {
  const lines = String(notes.content || "").split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return false;
  const line = lines[lineIndex];
  const m = line.match(/^(\s*-\s+\[)[ xX](\]\s*.*)$/);
  if (!m) return false;
  lines[lineIndex] = `${m[1]}${checked ? "x" : " "}${m[2]}`;
  notes.content = lines.join("\n");
  return true;
}

function insertNotesEditorText(editor, insert) {
  if (!editor) return;
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? start;
  const val = editor.value;
  editor.value = val.slice(0, start) + insert + val.slice(end);
  const pos = start + insert.length;
  editor.selectionStart = editor.selectionEnd = pos;
  editor.focus();
}

function wrapNotesSelection(editor, prefix, suffix) {
  if (!editor) return;
  const start = editor.selectionStart ?? 0;
  const end = editor.selectionEnd ?? 0;
  const val = editor.value;
  const selected = val.slice(start, end);
  const toInsert = prefix + selected + suffix;
  editor.value = val.slice(0, start) + toInsert + val.slice(end);
  const innerStart = start + prefix.length;
  if (selected.length > 0) {
    editor.selectionStart = innerStart;
    editor.selectionEnd = innerStart + selected.length;
  } else {
    editor.selectionStart = editor.selectionEnd = innerStart;
  }
  editor.focus();
}

function downloadNotesFile(notes, ext) {
  const body = notes.content || "";
  const type = ext === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${notesFilenameSafe(notes.name)}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded .${ext}`);
}

function printNotesPreview(section, notes) {
  const preview = $(".notes-preview", section);
  if (!preview) return;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    showToast("Allow pop-ups to print", true);
    return;
  }
  const title = escapeHtml(notes.name || "Notes");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:1.25rem;color:#111;}
h1{font-size:1.25rem;margin:0 0 1rem;}
hr{border:none;border-top:1px solid #ccc;margin:1rem 0;}
ul,ol{margin:0.35rem 0 0.35rem 1.25rem;}
del{opacity:0.65;}
code{background:#f0f0f0;padding:0.1em 0.3em;border-radius:3px;}
blockquote{border-left:3px solid #ccc;margin:0.5rem 0;padding-left:0.75rem;color:#444;}
u{text-decoration:underline;}
mark{background:rgba(255,235,59,0.35);padding:0 2px;border-radius:2px;}
.notes-md-checklist{list-style:none;padding-left:0;}
.notes-md-check-label{display:flex;gap:0.5rem;align-items:flex-start;}
@media print{body{margin:0.75rem;}}
</style></head><body>
<h1>${title}</h1>
${preview.innerHTML}
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

async function copyNotesClipboard(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(okMessage || "Copied to clipboard");
  } catch {
    showToast("Could not copy to clipboard", true);
  }
}

async function openQuickNoteModalFromNotes(notes) {
  await openQuickNoteModal();
  const bodyEl = $("#quick-note-note-body");
  if (bodyEl && notes.content) {
    bodyEl.innerHTML = renderBasicMarkdown(notes.content);
  }
  renderSelectedAttachments("quickNote");
}

function applyNotesTileAccent(section, notes) {
  const accent = String(notes.accent || "").trim();
  if (accent) {
    section.dataset.accent = "1";
    section.style.setProperty("--notes-accent", accent);
  } else {
    delete section.dataset.accent;
    section.style.removeProperty("--notes-accent");
  }
}

function duplicateNotesTile(notes) {
  const copy = newNotesTile({
    name: `${notes.name || "Notes"} (copy)`,
    content: notes.content || "",
    viewMode: notes.viewMode,
    defaultViewMode: notes.defaultViewMode,
    accent: notes.accent || "",
    updatedAt: new Date().toISOString(),
  });
  state.notesTiles.push(copy);
  const tid = notesTileId(copy);
  if (!state.tileLayout.order.includes(tid)) state.tileLayout.order.push(tid);
  saveLayoutToStorage();
  scheduleUserProfileSave();
  renderBoardGroups();
  showToast("Notes tile duplicated");
}

async function removeNotesTile(notes) {
  const label = notes.name?.trim() || "this notes tile";
  const ok = await confirmDialog({
    title: "Remove notes tile?",
    message: `Remove “${label}” from the dashboard? This cannot be undone.`,
    confirmLabel: "Remove",
    danger: true,
  });
  if (!ok) return;
  const tid = notesTileId(notes);
  state.notesTiles = state.notesTiles.filter((n) => n.id !== notes.id);
  state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
  delete state.tileLayout.widths[tid];
  delete state.tileLayout.heights[tid];
  delete state.tileLayout.collapsed?.[tid];
  saveLayoutToStorage();
  scheduleUserProfileSave();
  renderBoardGroups();
  showToast("Notes tile removed");
}

function bindNotesPreviewInteractions(section, notes) {
  if (!section || section.dataset.notesCheckBound) return;
  section.dataset.notesCheckBound = "1";
  section.addEventListener("change", (e) => {
    const cb = e.target.closest(".notes-md-check-input");
    if (!cb || !section.contains(cb)) return;
    const lineIndex = Number(cb.dataset.line);
    if (!Number.isFinite(lineIndex)) return;
    const editor = $(".notes-editor", section);
    if (toggleNotesCheckboxLine(notes, lineIndex, cb.checked)) {
      if (editor) editor.value = notes.content;
      scheduleNotesTileSave(notes);
      syncNotesTileBody(section, notes);
    }
  });
}

function scheduleNotesTileSave(notes) {
  touchNotesTile(notes);
  saveNotesTilesToStorage();
}

function syncNotesTileBody(section, notes) {
  const editor = $(".notes-editor", section);
  const preview = $(".notes-preview", section);
  if (!editor || !preview) return;
  const isPreview = notes.viewMode === "preview";
  editor.classList.toggle("hidden", isPreview);
  preview.classList.toggle("hidden", !isPreview);
  if (!isPreview) {
    if (editor.value !== notes.content) editor.value = notes.content || "";
  } else {
    preview.innerHTML = renderBasicMarkdown(notes.content);
  }
}

function bindNotesTileChrome(section, notes, tileId) {
  if (section.querySelector(":scope > .group-tile-bar")) return;

  const toolbar = document.createElement("div");
  toolbar.className = "tile-toolbar group-tile-bar notes-tile-bar";
  toolbar.draggable = true;
  toolbar.dataset.tileId = tileId;

  const hint = document.createElement("span");
  hint.className = "tile-drag-hint";
  hint.textContent = "⋮⋮";
  hint.setAttribute("aria-hidden", "true");
  hint.title = "Drag to reorder (left/right or up/down)";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "group-tile-name notes-tile-name";
  nameInput.placeholder = "Notes label";
  nameInput.value = notes.name || "";
  nameInput.setAttribute("aria-label", "Notes label");

  const utils = document.createElement("div");
  utils.className = "notes-tile-utils";

  const mkTextBtn = (label, className, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn btn-ghost ${className}`;
    b.textContent = label;
    if (title) b.title = title;
    return b;
  };

  const fileMenu = createTileMenu({
    label: "File",
    className: "btn-notes-file-menu",
    items: [
      {
        label: "Save as .txt",
        onSelect: () => downloadNotesFile(notes, "txt"),
      },
      {
        label: "Save as .md",
        onSelect: () => downloadNotesFile(notes, "md"),
      },
      {
        label: "Archive",
        onSelect: () => {
          archiveNotesTile(notes).catch((err) => showToast(err.message, true));
        },
      },
      {
        label: "Restore from archive…",
        onSelect: () => openNotesRestoreFromArchiveModal(notes),
      },
      {
        label: "Duplicate",
        onSelect: () => duplicateNotesTile(notes),
      },
    ],
  });

  const copyBtn = createTileIconActionButton(
    TILE_ICON_COPY,
    "Copy selection, or all if nothing selected",
    "btn-notes-copy"
  );
  const dateBtn = createTileIconActionButton(
    TILE_ICON_CALENDAR,
    "Insert date and time at cursor",
    "btn-notes-date"
  );
  const printBtn = createTileIconActionButton(TILE_ICON_PRINT, "Print preview", "btn-notes-print");
  const crmBtn = createTileIconActionButton(
    TILE_ICON_NOTE,
    "Open quick note with this text",
    "btn-notes-quick-note"
  );

  // List buttons for bullet and numbered lists (standard markdown editor behavior)
  const bulletBtn = mkTextBtn("•", "btn-notes-bullet", "Bullet list — inserts '- ' (auto-continues on Enter)");
  const numberedBtn = mkTextBtn("1.", "btn-notes-numbered", "Numbered list — inserts '1. ' (auto-continues + increments on Enter)");
  // Wrap the two list buttons tightly together with a visible box/shadow so they read as grouped action buttons.
  const listBtnsWrap = document.createElement("span");
  listBtnsWrap.className = "notes-list-btns";
  listBtnsWrap.appendChild(bulletBtn);
  listBtnsWrap.appendChild(numberedBtn);

  // Inline formatting buttons (bold/italic/underline/highlight/quote/code) placed next to lists.
  // Uses markdown syntax; renderer extended for _underline_ and ==highlight==.
  const boldBtn = mkTextBtn("B", "btn-notes-bold", "Bold — **text**");
  const italicBtn = mkTextBtn("I", "btn-notes-italic", "Italic — *text*");
  const strikeBtn = mkTextBtn("S", "btn-notes-strike", "Strikethrough — ~~text~~");
  const underlineBtn = mkTextBtn("U", "btn-notes-underline", "Underline — _text_");
  const highlightBtn = mkTextBtn("H", "btn-notes-highlight", "Highlight — ==text==");
  const quoteBtn = mkTextBtn(">", "btn-notes-quote", "Quote — > text (or selection)");
  const codeBtn = mkTextBtn("`", "btn-notes-code", "Inline code — `text`");
  const formatBtnsWrap = document.createElement("span");
  formatBtnsWrap.className = "notes-format-btns";
  formatBtnsWrap.append(boldBtn, italicBtn, strikeBtn, underlineBtn, highlightBtn, quoteBtn, codeBtn);

  const editBtn = mkTextBtn("Edit", "btn-notes-mode", "Edit mode");
  editBtn.dataset.mode = "edit";
  const previewBtn = mkTextBtn("Preview", "btn-notes-mode", "Preview mode");
  previewBtn.dataset.mode = "preview";

  const defaultPreviewBtn = createTileIconActionButton(
    TILE_ICON_PIN,
    "Always open this tile in preview on load",
    "btn-notes-default-preview btn-notes-pin"
  );

  const accentSel = document.createElement("select");
  accentSel.className = "notes-accent-select";
  accentSel.title = "Tile accent color";
  accentSel.setAttribute("aria-label", "Accent color");
  for (const opt of NOTES_ACCENT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    accentSel.appendChild(o);
  }
  accentSel.value = notes.accent || "";

  const { wrap, quarterBtn, halfBtn, fullBtn, tallBtn } = createLayoutButtons({
    showDoubleHeight: true,
    showQuarterWidth: true,
  });

  utils.append(
    fileMenu,
    copyBtn,
    dateBtn,
    listBtnsWrap,
    formatBtnsWrap,
    printBtn,
    crmBtn,
    accentSel,
    defaultPreviewBtn,
    editBtn,
    previewBtn
  );

  const removeBtn = createTileRemoveButton("Remove this notes tile from the dashboard", "btn-remove-notes");

  toolbar.appendChild(hint);
  toolbar.appendChild(nameInput);
  toolbar.appendChild(utils);
  toolbar.appendChild(removeBtn);
  toolbar.appendChild(wrap);

  section.prepend(toolbar);
  bindTileLayoutButtons(section, tileId, halfBtn, fullBtn, tallBtn, quarterBtn);
  bindTileDragDrop(section, tileId, toolbar);
  attachTileCollapseButton(section, tileId);
  bindNotesPreviewInteractions(section, notes);

  const syncModeButtons = () => {
    const isPreview = notes.viewMode === "preview";
    editBtn.classList.toggle("tile-btn-active", !isPreview);
    previewBtn.classList.toggle("tile-btn-active", isPreview);
    defaultPreviewBtn.classList.toggle("tile-btn-active", notes.defaultViewMode === "preview");
    syncNotesTileBody(section, notes);
    syncNotesUpdatedFooter(section, notes);
  };

  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    let text = notes.content || "";
    let msg = "Copied all";
    if (editor && notes.viewMode !== "preview") {
      const start = editor.selectionStart ?? 0;
      const end = editor.selectionEnd ?? 0;
      if (end > start) {
        text = editor.value.slice(start, end);
        msg = "Copied selection";
      }
    }
    await copyNotesClipboard(text, msg);
  });

  dateBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    const stamp = formatNotesDateStamp();
    if (editor && notes.viewMode !== "preview") {
      insertNotesEditorText(editor, stamp);
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    } else {
      notes.content = `${notes.content || ""}${notes.content ? "\n" : ""}${stamp}\n`;
      scheduleNotesTileSave(notes);
      syncNotesTileBody(section, notes);
    }
  });

  bulletBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      insertNotesEditorText(editor, "- ");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });

  numberedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      insertNotesEditorText(editor, "1. ");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });

  // Formatting button handlers (wrap selection or insert placeholder syntax)
  boldBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      wrapNotesSelection(editor, "**", "**");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });
  italicBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      wrapNotesSelection(editor, "*", "*");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });
  strikeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      wrapNotesSelection(editor, "~~", "~~");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });
  underlineBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      wrapNotesSelection(editor, "_", "_");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });
  highlightBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      wrapNotesSelection(editor, "==", "==");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });
  quoteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      insertNotesEditorText(editor, "> ");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });
  codeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editor = $(".notes-editor", section);
    if (editor && notes.viewMode !== "preview") {
      wrapNotesSelection(editor, "`", "`");
      notes.content = editor.value;
      scheduleNotesTileSave(notes);
    }
  });

  printBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (notes.viewMode !== "preview") {
      notes.viewMode = "preview";
      saveNotesTilesToStorage();
      syncModeButtons();
    }
    printNotesPreview(section, notes);
  });

  crmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openQuickNoteModalFromNotes(notes).catch((err) => showToast(err.message, true));
  });

  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeNotesTile(notes);
  });

  defaultPreviewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notes.defaultViewMode = notes.defaultViewMode === "preview" ? null : "preview";
    if (notes.defaultViewMode === "preview") notes.viewMode = "preview";
    scheduleNotesTileSave(notes);
    syncModeButtons();
    showToast(
      notes.defaultViewMode === "preview"
        ? "Will open in preview on load"
        : "Default preview on load off"
    );
  });

  accentSel.addEventListener("click", (e) => e.stopPropagation());
  accentSel.addEventListener("change", (e) => {
    e.stopPropagation();
    notes.accent = accentSel.value;
    applyNotesTileAccent(section, notes);
    scheduleNotesTileSave(notes);
  });

  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notes.viewMode = "edit";
    saveNotesTilesToStorage();
    syncModeButtons();
    $(".notes-editor", section)?.focus();
  });

  previewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notes.viewMode = "preview";
    saveNotesTilesToStorage();
    syncModeButtons();
  });

  nameInput.addEventListener("input", () => {
    notes.name = nameInput.value;
    section.dataset.tileLabel = notes.name || "Notes";
    scheduleNotesTileSave(notes);
  });
  nameInput.addEventListener("change", () => {
    notes.name = nameInput.value.trim() || "Notes";
    nameInput.value = notes.name;
    section.dataset.tileLabel = notes.name;
    scheduleNotesTileSave(notes);
  });

  const editor = $(".notes-editor", section);
  editor?.addEventListener("input", () => {
    notes.content = editor.value;
    scheduleNotesTileSave(notes);
  });

  // Auto-continue bullet (- * +) and numbered (1. 2. ...) lists on Enter (common markdown editor behavior).
  // Shift+Enter inserts a plain newline without continuing the list.
  if (editor && !editor.dataset.listEnterBound) {
    editor.dataset.listEnterBound = "1";
    editor.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || notes.viewMode === "preview") return;
      const val = editor.value;
      const pos = editor.selectionStart || 0;
      const ls = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      const fullLine = val.slice(ls, lineEnd > -1 ? lineEnd : undefined);
      // bullet list (supports indent)
      const bMatch = fullLine.match(/^(\s*)([-*+])(\s+)/);
      if (bMatch) {
        e.preventDefault();
        const prefix = bMatch[1] + bMatch[2] + bMatch[3];
        insertNotesEditorText(editor, "\n" + prefix);
        notes.content = editor.value;
        scheduleNotesTileSave(notes);
        return;
      }
      // numbered list: increment
      const nMatch = fullLine.match(/^(\s*)(\d+)(\.\s+)/);
      if (nMatch) {
        e.preventDefault();
        const num = parseInt(nMatch[2], 10) + 1;
        const prefix = nMatch[1] + num + nMatch[3];
        insertNotesEditorText(editor, "\n" + prefix);
        notes.content = editor.value;
        scheduleNotesTileSave(notes);
      }
    });
  }

  applyNotesTileAccent(section, notes);
  syncModeButtons();

  // Initial restructure for narrow notes (resizing on top row)
  ensureNotesToolbarRows(section);
}

function renderNotesTiles(dash) {
  for (const notes of activeNotesTiles()) {
    applyNotesDefaultViewOnLoad(notes);
    const tileId = notesTileId(notes);
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile notes-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = notes.name || "Notes";
    section.dataset.notesId = notes.id;
    section.innerHTML = `
      <div class="notes-tile-body">
        <textarea class="notes-editor" placeholder="Notes &amp; to-dos — **bold** *italic* ~~strike~~ _underline_ ==highlight== &gt; quote \`code\` # h1 ## h2 - [ ] tasks 1. lists --- hr, links" spellcheck="true"></textarea>
        <div class="notes-preview hidden" aria-live="polite"></div>
        <div class="notes-tile-footer" aria-live="polite">
          <span class="notes-stats-label"></span>
          <span class="notes-updated-label"></span>
        </div>
      </div>
    `;
    dash.appendChild(section);
    bindNotesTileChrome(section, notes, tileId);
    ensureNotesToolbarRows(section);
    notes._el = section;
    const editor = $(".notes-editor", section);
    if (editor) editor.value = notes.content || "";
    syncNotesTileBody(section, notes);
    syncNotesUpdatedFooter(section, notes);
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
  }
}

function renderLocalKanbanTiles(dash) {
  if (!dash) return;
  // Clear any previous local kanban DOM elements (they share board-group styling but are not cleared by renderBoardGroups).
  dash.querySelectorAll(".local-kanban-tile").forEach((el) => el.remove());

  for (const kanban of activeLocalKanbanTiles()) {
    const tileId = localKanbanTileId(kanban);
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile local-kanban-tile";
    section.dataset.tileId = tileId;
    // Set dataset.tileLabel so bindTileChrome / createTileChrome puts the editable name in the standard tile toolbar title bar (top chrome).
    section.dataset.tileLabel = kanban.name || "Kanban";
    section.dataset.kanbanId = kanban.id;

    // Name is now in the tile's title bar (toolbar). The local header below just hosts the +status / +task controls.
    section.innerHTML = `
      <div class="local-kanban-body">
        <div class="local-kanban-header">
          <button type="button" class="local-kanban-add-col btn btn-ghost btn-small" title="Add custom status">+ status</button>
          <button type="button" class="local-kanban-add-card btn btn-ghost btn-small" title="Add custom task">+ task</button>
        </div>
        <div class="board"></div>
      </div>
    `;
    dash.appendChild(section);

    const board = section.querySelector('.board');
    buildLocalKanbanBoard(board, kanban, section);

    bindLocalKanbanTileChrome(section, kanban, tileId);
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
    kanban._el = section;
  }
}

function bindLocalKanbanTileChrome(section, kanban, tileId) {
  bindTileChrome(section, tileId);

  const tb = section.querySelector(':scope > .tile-toolbar');

  // Guard: remove any duplicate archive/delete buttons from previous binds
  if (tb) {
    tb.querySelectorAll('.btn-archive-kanban, .btn-remove-kanban').forEach(b => b.remove());
  }

  // Archive button (file cabinet icon)
  const archiveBtn = createTileIconActionButton(
    TILE_ICON_ARCHIVE,
    "Archive this local kanban board",
    "btn-archive-kanban"
  );
  if (tb) tb.appendChild(archiveBtn);
  archiveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openLocalKanbanArchiveModal(kanban);
  });

  // Remove button (only 1)
  const removeBtn = createTileRemoveButton("Remove this local kanban board from the dashboard", "btn-remove-kanban");
  if (tb) tb.appendChild(removeBtn);
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeLocalKanbanTile(kanban, section);
  });

  // The name now lives in the standard tile toolbar title bar (created by bindTileChrome from dataset.tileLabel).
  // Make that title editable via dblclick (contentEditable pattern), and keep it in sync with kanban.name.
  const toolbarTitle = section.querySelector(':scope > .tile-toolbar .tile-toolbar-title');
  if (toolbarTitle && !toolbarTitle.dataset.kanbanTitleBound) {
    toolbarTitle.dataset.kanbanTitleBound = '1';
    toolbarTitle.title = 'Double-click to rename board';
    toolbarTitle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const orig = toolbarTitle.textContent;
      toolbarTitle.contentEditable = 'true';
      toolbarTitle.focus();
      const sel = window.getSelection();
      const r = document.createRange();
      r.selectNodeContents(toolbarTitle);
      sel.removeAllRanges();
      sel.addRange(r);
      const finish = () => {
        toolbarTitle.contentEditable = 'false';
        let newName = (toolbarTitle.textContent || '').trim() || 'Kanban';
        if (newName !== orig) {
          kanban.name = newName;
          kanban.updatedAt = new Date().toISOString();
          toolbarTitle.textContent = newName;
          section.dataset.tileLabel = newName;
          saveLocalKanbanTilesToStorage();
          saveLayoutToStorage();
        } else {
          toolbarTitle.textContent = orig;
        }
      };
      toolbarTitle.addEventListener('blur', finish, {once: true});
      toolbarTitle.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          finish();
        } else if (ke.key === 'Escape') {
          toolbarTitle.textContent = orig;
          finish();
        }
      }, {once: true});
    });
  }

  // Guard to prevent multiple listeners on re-binds (which caused multi adds)
  // + status button in title bar - opens inline dark field (no popup)
  const addColBtn = section.querySelector('.local-kanban-add-col');
  if (addColBtn && !addColBtn.dataset.kanbanBound) {
    addColBtn.dataset.kanbanBound = '1';
    addColBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // already open? 
      if (addColBtn.nextElementSibling && addColBtn.nextElementSibling.classList.contains('kanban-inline-input')) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Status / stage name';
      input.className = 'kanban-inline-input';
      input.style.cssText = 'background:var(--surface);color:var(--text);border:1px solid var(--border);padding:2px 4px;font-size:0.8rem;margin-left:4px;width:120px;';
      addColBtn.parentNode.insertBefore(input, addColBtn.nextSibling);
      input.focus();
      let submitted = false;
      const cleanup = () => {
        // setTimeout(0) + guard to avoid NotFoundError "node no longer a child" races during blur + rebuild
        setTimeout(() => {
          if (input && input.parentNode) input.parentNode.removeChild(input);
        }, 0);
      };
      const doAdd = () => {
        if (submitted) return;
        submitted = true;
        const val = input.value.trim();
        if (val) {
          if (!kanban.columns) kanban.columns = [];
          kanban.columns.push({ id: crypto.randomUUID(), title: val, cards: [] });
          kanban.updatedAt = new Date().toISOString();
          saveLocalKanbanTilesToStorage();
          const board = section.querySelector('.board');
          buildLocalKanbanBoard(board, kanban, section);
          bindLocalKanbanTileChrome(section, kanban, localKanbanTileId(kanban));
        }
        cleanup();
      };
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { doAdd(); }
        else if (ke.key === 'Escape') cleanup();
      });
      input.addEventListener('blur', () => { if (!submitted) doAdd(); });
    });
  }

  // + task button in title bar ( + icon with "task" label; adds to first column; inline field no popup)
  const addCardBtn = section.querySelector('.local-kanban-add-card');
  if (addCardBtn && !addCardBtn.dataset.kanbanBound) {
    addCardBtn.dataset.kanbanBound = '1';
    addCardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (addCardBtn.nextElementSibling && addCardBtn.nextElementSibling.classList.contains('kanban-inline-input')) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Task name';
      input.className = 'kanban-inline-input';
      input.style.cssText = 'background:var(--surface);color:var(--text);border:1px solid var(--border);padding:2px 4px;font-size:0.8rem;margin-left:4px;width:120px;';
      addCardBtn.parentNode.insertBefore(input, addCardBtn.nextSibling);
      input.focus();
      let submitted = false;
      const cleanup = () => {
        // setTimeout(0) + guard to avoid NotFoundError "node no longer a child" races during blur + rebuild
        setTimeout(() => {
          if (input && input.parentNode) input.parentNode.removeChild(input);
        }, 0);
      };
      const doAdd = () => {
        if (submitted) return;
        submitted = true;
        const val = input.value.trim();
        if (val) {
          const targetCol = (kanban.columns || [])[0];
          if (targetCol) {
            if (!targetCol.cards) targetCol.cards = [];
            targetCol.cards.push({ id: crypto.randomUUID(), title: val, description: '', notes: [] });
            kanban.updatedAt = new Date().toISOString();
            saveLocalKanbanTilesToStorage();
            const board = section.querySelector('.board');
            buildLocalKanbanBoard(board, kanban, section);
            bindLocalKanbanTileChrome(section, kanban, localKanbanTileId(kanban));
          }
        }
        cleanup();
      };
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { doAdd(); }
        else if (ke.key === 'Escape') cleanup();
      });
      input.addEventListener('blur', () => { if (!submitted) doAdd(); });
    });
  }
}

function setupLocalKanbanDragDrop(container, kanban, section) {
  container.querySelectorAll('.card').forEach(cardEl => {
    cardEl.addEventListener('dragstart', e => {
      e.stopPropagation();
      e.dataTransfer.setData('text/plain', cardEl.dataset.cardId);
      e.dataTransfer.setData('kanban/from-col', cardEl.dataset.colId);
      cardEl.classList.add('dragging');
    });
    cardEl.addEventListener('dragend', e => {
      e.stopPropagation();
      cardEl.classList.remove('dragging');
    });
  });

  container.querySelectorAll('.column-body').forEach(body => {
    body.addEventListener('dragover', e => {
      e.stopPropagation();
      e.preventDefault();
      body.classList.add('drag-over');
    });
    body.addEventListener('dragleave', e => {
      e.stopPropagation();
      body.classList.remove('drag-over');
    });
    body.addEventListener('drop', e => {
      e.stopPropagation();
      e.preventDefault();
      body.classList.remove('drag-over');
      // Column reordering via drag scrapped (edit button ◀/▶ now handles sliding stages left/right).
      const cardId = e.dataTransfer.getData('text/plain');
      const fromColId = e.dataTransfer.getData('kanban/from-col') || '';
      const toColId = body.dataset.colId;
      if (!cardId || !toColId || fromColId === toColId) return;
      moveLocalKanbanCard(kanban, fromColId, toColId, cardId);
      saveLocalKanbanTilesToStorage();
      buildLocalKanbanBoard(container, kanban, section);
    });
  });
}

function buildLocalKanbanBoard(container, kanban, section) {
  container.innerHTML = '';
  for (const col of (kanban.columns || [])) {
    const column = document.createElement('section');
    column.className = 'column' + ((col.cards || []).length === 0 ? ' column-empty' : '');
    column.dataset.colId = col.id;
    // Column drag/reorder scrapped per request (drag didn't work reliably; use edit buttons to slide left/right instead).
    // No draggable, no dragstart for 'col:' on the column itself.

    const header = document.createElement('div');
    header.className = 'column-header';
    // Include column-dot so color picker visibly affects the stage header (always shown, not just card borders or when populated).
    header.innerHTML = `
      <span class="column-dot" style="background:${escapeHtml(col.color || '#ccc')}"></span>
      <span class="column-title">${escapeHtml(col.title)}</span>
      <span class="column-count">${(col.cards || []).length}</span>
      <button type="button" class="local-kanban-edit-col btn btn-ghost btn-tiny" title="Edit name, color, and slide position" style="padding:0 3px; margin-left:2px;">✎</button>
      <button type="button" class="local-kanban-del-col btn btn-ghost btn-tiny" title="Delete this status" style="padding:0 3px; margin-left:4px;">×</button>
    `;
    // discrete delete for status, with move if cards
    header.querySelector('.local-kanban-del-col').addEventListener('click', e => {
      e.stopPropagation();
      const cardsCount = (col.cards || []).length;
      if (cardsCount > 0) {
        if (!confirm(`Delete status “${col.title}”? Its ${cardsCount} task(s) will be moved to another status or lost.`)) return;
        const other = kanban.columns.find(c => c.id !== col.id);
        if (other) {
          other.cards = (other.cards || []).concat(col.cards || []);
        }
      }
      kanban.columns = kanban.columns.filter(c => c.id !== col.id);
      kanban.updatedAt = new Date().toISOString();
      saveLocalKanbanTilesToStorage();
      buildLocalKanbanBoard(container, kanban, section);
    });

    // edit button for column name/color + left/right slide (edit is to the LEFT of ×)
    const editBtn = header.querySelector('.local-kanban-edit-col');
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      const titleSpan = header.querySelector('.column-title');
      const dotSpan = header.querySelector('.column-dot');
      const origTitle = col.title || '';
      const origColor = col.color || '#4f8cff';
      titleSpan.style.display = 'none';
      if (dotSpan) dotSpan.style.display = 'none';
      const editWrap = document.createElement('span');
      editWrap.style.display = 'inline-flex';
      editWrap.style.gap = '2px';
      editWrap.style.alignItems = 'center';
      editWrap.innerHTML = `
        <input type="text" value="${escapeHtml(origTitle)}" style="background:var(--surface);color:var(--text);border:1px solid var(--border);font-size:0.7rem;width:70px;padding:1px;" />
        <input type="color" value="${origColor}" style="width:16px;height:14px;padding:0;border:0;" />
        <button class="btn btn-ghost btn-tiny" title="Move stage left" style="padding:0 1px;font-size:0.6rem;">◀</button>
        <button class="btn btn-ghost btn-tiny" title="Move stage right" style="padding:0 1px;font-size:0.6rem;">▶</button>
        <button class="btn btn-ghost btn-tiny" style="padding:0 1px;font-size:0.6rem;">✓</button>
        <button class="btn btn-ghost btn-tiny" style="padding:0 1px;font-size:0.6rem;">✕</button>
      `;
      header.insertBefore(editWrap, titleSpan.nextSibling);
      const ins = editWrap.querySelectorAll('input');
      const nameIn = ins[0];
      const colorIn = ins[1];
      const leftBtn = editWrap.querySelectorAll('button')[0];
      const rightBtn = editWrap.querySelectorAll('button')[1];
      const okBtn = editWrap.querySelectorAll('button')[2];
      const cancelBtn = editWrap.querySelectorAll('button')[3];
      const clean = () => {
        titleSpan.style.display = '';
        if (dotSpan) dotSpan.style.display = '';
        editWrap.remove();
      };
      const doSaveAndRebuild = () => {
        col.title = nameIn.value.trim() || origTitle;
        col.color = colorIn.value;
        kanban.updatedAt = new Date().toISOString();
        saveLocalKanbanTilesToStorage();
        buildLocalKanbanBoard(container, kanban, section);
        clean();
      };
      okBtn.onclick = doSaveAndRebuild;
      cancelBtn.onclick = clean;

      // Slide left/right using edit buttons (no column drag)
      leftBtn.onclick = () => {
        const idx = kanban.columns.findIndex(c => c.id === col.id);
        if (idx > 0) {
          const [moved] = kanban.columns.splice(idx, 1);
          kanban.columns.splice(idx - 1, 0, moved);
          kanban.updatedAt = new Date().toISOString();
          saveLocalKanbanTilesToStorage();
          buildLocalKanbanBoard(container, kanban, section);
          // re-open edit on the moved column after rebuild (find by id in new DOM)
          setTimeout(() => {
            const newHeader = container.querySelector(`.column[data-col-id="${col.id}"] .column-header`);
            if (newHeader) {
              const newEdit = newHeader.querySelector('.local-kanban-edit-col');
              if (newEdit) newEdit.click();
            }
          }, 0);
        }
      };
      rightBtn.onclick = () => {
        const idx = kanban.columns.findIndex(c => c.id === col.id);
        if (idx >= 0 && idx < kanban.columns.length - 1) {
          const [moved] = kanban.columns.splice(idx, 1);
          kanban.columns.splice(idx + 1, 0, moved);
          kanban.updatedAt = new Date().toISOString();
          saveLocalKanbanTilesToStorage();
          buildLocalKanbanBoard(container, kanban, section);
          setTimeout(() => {
            const newHeader = container.querySelector(`.column[data-col-id="${col.id}"] .column-header`);
            if (newHeader) {
              const newEdit = newHeader.querySelector('.local-kanban-edit-col');
              if (newEdit) newEdit.click();
            }
          }, 0);
        }
      };

      nameIn.focus();
      nameIn.select();
    });

    const body = document.createElement('div');
    body.className = 'column-body';
    body.dataset.colId = col.id;

    for (const card of (col.cards || [])) {
      const cardEl = document.createElement('article');
      cardEl.className = 'card';
      cardEl.dataset.cardId = card.id;
      cardEl.dataset.colId = col.id;
      cardEl.draggable = true;

      if (card.color) {
        cardEl.style.borderLeft = `4px solid ${card.color}`;
      }

      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = card.title || '(untitled)';
      cardEl.appendChild(title);

      const dueInfo = getCardDueInfo(card.due);
      if (dueInfo) {
        const dueEl = document.createElement('p');
        dueEl.className = 'card-due' + (dueInfo.isOverdueOrSoon ? ' card-due--overdue' : '');
        let txt = dueInfo.label;
        if (card.due) {
          try {
            const dstr = new Date(card.due).toLocaleDateString();
            txt = `${dstr} — ${dueInfo.label}`;
          } catch {}
        }
        dueEl.textContent = txt;
        cardEl.appendChild(dueEl);
      }

      if (card.description) {
        const desc = document.createElement('p');
        desc.className = 'card-description';
        desc.textContent = card.description.substring(0, 60) + (card.description.length > 60 ? '…' : '');
        cardEl.appendChild(desc);
      }

      if (card.lastUpdated) {
        const upd = document.createElement('p');
        upd.className = 'card-updated';
        upd.style.fontSize = '0.65rem';
        upd.style.color = 'var(--muted)';
        const ago = (typeof formatTimeAgo === 'function') ? formatTimeAgo(card.lastUpdated) : '';
        upd.textContent = 'Updated ' + ago;
        cardEl.appendChild(upd);
      }

      cardEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        openLocalKanbanCardModal(kanban, col.id, card.id, section);
      });

      body.appendChild(cardEl);
    }

    column.appendChild(header);
    column.appendChild(body);
    container.appendChild(column);
  }

  setupLocalKanbanDragDrop(container, kanban, section);
}

function refreshLocalKanbanColumns(section, kanban) {
  const board = section.querySelector('.board');
  if (board) {
    buildLocalKanbanBoard(board, kanban, section);
    // re-attach header controls after rebuild
    bindLocalKanbanTileChrome(section, kanban, localKanbanTileId(kanban));
  }
}

function moveLocalKanbanCard(kanban, fromColId, toColId, cardId) {
  const fromCol = (kanban.columns || []).find(c => c.id === fromColId);
  const toCol = (kanban.columns || []).find(c => c.id === toColId);
  if (!fromCol || !toCol) return;
  const cardIdx = (fromCol.cards || []).findIndex(c => c.id === cardId);
  if (cardIdx < 0) return;
  const [card] = fromCol.cards.splice(cardIdx, 1);
  if (!toCol.cards) toCol.cards = [];
  toCol.cards.push(card);
  kanban.updatedAt = new Date().toISOString();
}

function addLocalKanbanCard(kanban, colId, section) {
  const title = prompt('Task title / short desc:');
  if (!title || !title.trim()) return;
  const col = (kanban.columns || []).find(c => c.id === colId);
  if (!col) return;
  if (!col.cards) col.cards = [];
  const card = { id: crypto.randomUUID(), title: title.trim(), description: '', notes: [] };
  col.cards.push(card);
  kanban.updatedAt = new Date().toISOString();
  saveLocalKanbanTilesToStorage();
  refreshLocalKanbanColumns(section, kanban);
  openLocalKanbanCardModal(kanban, colId, card.id, section);
}

function addLocalKanbanColumn(kanban, section) {
  const title = prompt('New custom status / column name:');
  if (!title || !title.trim()) return;
  if (!kanban.columns) kanban.columns = [];
  kanban.columns.push({ id: crypto.randomUUID(), title: title.trim(), cards: [] });
  kanban.updatedAt = new Date().toISOString();
  saveLocalKanbanTilesToStorage();
  refreshLocalKanbanColumns(section, kanban);
  setupLocalKanbanDragDrop(section, kanban);
}

function getCardDueInfo(due) {
  if (!due) return null;
  try {
    const dueDate = new Date(due);
    const now = new Date();
    const diffMs = dueDate - now;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return {
      days,
      isOverdueOrSoon: days <= 3,
      label: days < 0 ? `Overdue by ${Math.abs(days)} day(s)` : `Due in ${days} day(s)`
    };
  } catch { return null; }
}

async function removeLocalKanbanTile(kanban, section) {
  const label = kanban.name?.trim() || "this local kanban";
  confirmDialog({
    title: "Remove local kanban?",
    message: `Remove “${label}” from the dashboard? This cannot be undone.`,
    confirmLabel: "Remove",
    danger: true,
  }).then(ok => {
    if (!ok) return;
    const tid = localKanbanTileId(kanban);
    state.localKanbanTiles = (state.localKanbanTiles || []).filter((k) => k.id !== kanban.id);
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    delete state.tileLayout.collapsed[tid];
    saveLocalKanbanTilesToStorage();
    saveLayoutToStorage();
    if (section && section.parentNode) section.parentNode.removeChild(section);
    refreshDashboardTileLayouts();
  });
}

function archiveLocalKanbanTile(kanban, section) {
  const label = kanban.name?.trim() || "this local kanban";
  confirmDialog({
    title: "Archive local kanban?",
    message: `Archive “${label}”? It can be restored later from the add tile menu.`,
    confirmLabel: "Archive",
    danger: true,
  }).then(ok => {
    if (!ok) return;
    kanban.archived = true;
    const tid = localKanbanTileId(kanban);
    state.tileLayout.order = state.tileLayout.order.filter((id) => id !== tid);
    delete state.tileLayout.widths[tid];
    delete state.tileLayout.heights[tid];
    delete state.tileLayout.collapsed[tid];
    saveLocalKanbanTilesToStorage();
    saveLayoutToStorage();
    if (section && section.parentNode) section.parentNode.removeChild(section);
    refreshDashboardTileLayouts();
    showToast("Kanban archived. Use Add Tile > Restore archived local kanban to bring it back.");
  });
}

function openLocalKanbanArchiveModal(currentKanban = null) {
  let modal = document.getElementById('local-kanban-archive-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'local-kanban-archive-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" data-kanban-archive-dismiss></div>
      <div class="modal-card" style="max-width:420px;">
        <h3 class="modal-title">Archived Kanban Boards</h3>
        <div id="local-kanban-archive-list" style="max-height:220px; overflow:auto; margin:0.5rem 0; font-size:0.9rem;"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-kanban-archive-dismiss>Close</button>
          ${currentKanban ? '<button type="button" id="local-kanban-do-archive-current" class="btn btn-secondary">Archive current board</button>' : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-kanban-archive-dismiss]').forEach(el => {
      el.addEventListener('click', () => modal.classList.add('hidden'));
    });
  }
  modal.classList.remove('hidden');

  const listEl = modal.querySelector('#local-kanban-archive-list');
  const archived = (state.localKanbanTiles || []).filter(k => k.archived);
  listEl.innerHTML = '';
  if (!archived.length) {
    listEl.innerHTML = '<p style="color:var(--muted);">No archived boards yet.</p>';
  } else {
    archived.forEach(k => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.marginBottom = '0.25rem';
      row.innerHTML = `<span>${escapeHtml(k.name || 'Unnamed')}</span>`;
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'btn btn-ghost btn-small';
      restore.textContent = 'Restore as new tile';
      restore.addEventListener('click', () => {
        k.archived = false;
        const tid = localKanbanTileId(k);
        if (!state.tileLayout.order.includes(tid)) {
          state.tileLayout.order.push(tid);
        }
        saveLocalKanbanTilesToStorage();
        saveLayoutToStorage();
        renderBoardGroups();
        modal.classList.add('hidden');
        showToast(`Restored “${k.name || 'board'}” as new tile`);
      });
      row.appendChild(restore);
      listEl.appendChild(row);
    });
  }

  const doArchiveBtn = modal.querySelector('#local-kanban-do-archive-current');
  if (doArchiveBtn && currentKanban) {
    doArchiveBtn.onclick = () => {
      currentKanban.archived = true;
      const tid = localKanbanTileId(currentKanban);
      state.tileLayout.order = state.tileLayout.order.filter(id => id !== tid);
      delete state.tileLayout.widths[tid];
      delete state.tileLayout.heights[tid];
      delete state.tileLayout.collapsed[tid];
      saveLocalKanbanTilesToStorage();
      saveLayoutToStorage();
      if (currentKanban._el && currentKanban._el.parentNode) {
        currentKanban._el.parentNode.removeChild(currentKanban._el);
      }
      renderBoardGroups();
      modal.classList.add('hidden');
      showToast('Board archived. Re-open this popup from any kanban tile to restore.');
    };
  }
}

function openLocalKanbanCardModal(kanban, colId, cardId, tileSection) {
  let modal = document.getElementById('local-kanban-card-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'local-kanban-card-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" data-kanban-card-dismiss></div>
      <div class="modal-card" style="max-width:520px;">
        <div class="field">
          <label>Task name</label>
          <input type="text" id="local-kanban-card-title-input" />
        </div>
        <div class="field">
          <label>Description / details</label>
          <textarea id="local-kanban-card-desc" rows="3" placeholder="Description..."></textarea>
        </div>
        <div class="field">
          <label>Color</label>
          <input type="color" id="local-kanban-card-color" />
        </div>
        <div class="field">
          <label>Due date</label>
          <input type="date" id="local-kanban-card-due" />
        </div>
        <div class="field">
          <label>Notes (add &amp; dated history)</label>
          <div style="display:flex; gap:0.5rem;">
            <input type="text" id="local-kanban-card-note-input" placeholder="Add note..." style="flex:1;" />
            <button type="button" id="local-kanban-card-note-add" class="btn btn-primary btn-small">Add</button>
          </div>
          <div id="local-kanban-card-notes-list" class="local-kanban-notes-list" style="max-height:140px; overflow:auto; margin-top:0.5rem; font-size:0.85rem; border:1px solid var(--border); padding:0.25rem; background:var(--surface);"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-kanban-card-dismiss>Close</button>
          <button type="button" id="local-kanban-card-save" class="btn btn-primary">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-kanban-card-dismiss]').forEach(el => el.addEventListener('click', () => modal.classList.add('hidden')));
  }
  modal.classList.remove('hidden');

  const col = (kanban.columns || []).find(c => c.id === colId);
  const card = col && (col.cards || []).find(c => c.id === cardId);
  if (!card) { modal.classList.add('hidden'); return; }

  const titleInput = modal.querySelector('#local-kanban-card-title-input');
  titleInput.value = card.title || '';

  const descEl = modal.querySelector('#local-kanban-card-desc');
  descEl.value = card.description || '';

  const colorEl = modal.querySelector('#local-kanban-card-color');
  colorEl.value = card.color || '#4f8cff';

  const dueEl = modal.querySelector('#local-kanban-card-due');
  dueEl.value = card.due || '';

  const notesList = modal.querySelector('#local-kanban-card-notes-list');
  function renderNotes() {
    notesList.innerHTML = '';
    const notes = (card.notes || []).slice().sort((a,b) => (b.ts||'').localeCompare(a.ts||''));
    if (!notes.length) {
      notesList.innerHTML = '<div style="color:var(--muted); font-size:0.8rem;">No notes yet.</div>';
      return;
    }
    notes.forEach(n => {
      const d = document.createElement('div');
      d.style.borderBottom = '1px solid var(--border)';
      d.style.padding = '0.2rem 0';
      const dateStr = n.ts ? new Date(n.ts).toLocaleString() : '';
      d.innerHTML = `<div style="font-size:0.7rem; color:var(--muted);">${escapeHtml(dateStr)}</div><div>${escapeHtml(n.text || '')}</div>`;
      notesList.appendChild(d);
    });
  }
  renderNotes();

  const noteInput = modal.querySelector('#local-kanban-card-note-input');
  const addNoteBtn = modal.querySelector('#local-kanban-card-note-add');
  addNoteBtn.onclick = () => {
    const txt = (noteInput.value || '').trim();
    if (!txt) return;
    if (!card.notes) card.notes = [];
    card.notes.push({ ts: new Date().toISOString(), text: txt });
    card.lastUpdated = new Date().toISOString();
    kanban.updatedAt = new Date().toISOString();
    noteInput.value = '';
    renderNotes();
    saveLocalKanbanTilesToStorage();
    refreshLocalKanbanColumns(tileSection, kanban);
  };
  noteInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addNoteBtn.click(); } };

  modal.querySelector('#local-kanban-card-save').onclick = () => {
    card.title = titleInput.value.trim() || card.title || 'Task';
    card.description = descEl.value || '';
    card.color = colorEl.value || '#4f8cff';
    card.due = dueEl.value || '';
    kanban.updatedAt = new Date().toISOString();
    saveLocalKanbanTilesToStorage();
    refreshLocalKanbanColumns(tileSection, kanban);
    modal.classList.add('hidden');
  };
}

function normalizeTagTitle(tag) {
  if (tag == null) return "";
  if (typeof tag === "string") return tag.trim();
  return String(tag.title ?? tag.Title ?? tag.name ?? tag.Name ?? "").trim();
}

function buildTagCatalog() {
  const byTitleLower = new Map();
  const byId = new Map();
  for (const tag of state.allTags) {
    const title = normalizeTagTitle(tag.title ?? tag);
    const id = tag.id ?? tag.ID ?? tag.Id;
    if (title) byTitleLower.set(title.toLowerCase(), { title, id });
    if (id != null) byId.set(String(id), { title, id });
  }
  return { byTitleLower, byId };
}

function tagLookupKey(value, catalog) {
  const raw = normalizeTagTitle(value);
  if (!raw) return "";
  if (catalog?.byId?.has(raw)) {
    return catalog.byId.get(raw).title.toLowerCase();
  }
  const lower = raw.toLowerCase();
  if (catalog?.byTitleLower?.has(lower)) return lower;
  return lower;
}

function tagsEqual(a, b, catalog = buildTagCatalog()) {
  const x = tagLookupKey(a, catalog);
  const y = tagLookupKey(b, catalog);
  return x && y && x === y;
}

function getOppTagsFromRecord(opp) {
  const titles = new Set();
  const add = (t) => {
    const n = normalizeTagTitle(t);
    if (n) titles.add(n);
  };

  const sources = [
    opp.tags,
    opp.Tags,
    opp.tagList,
    opp.TagList,
    opp.tag,
    opp.Tag,
    opp.linkTags,
    opp.LinkTags,
    opp.tagsInfo,
    opp.TagsInfo,
    opp.tagAccessories,
    opp.TagAccessories,
  ];

  for (const raw of sources) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const t of raw) add(t);
    } else if (typeof raw === "string") {
      raw.split(",").forEach(add);
    } else if (typeof raw === "object") {
      add(raw);
    }
  }

  return [...titles];
}

function getOppTags(opp) {
  return getOppTagsFromRecord(opp);
}

function oppHasTag(opp, tagTitle, catalog = buildTagCatalog()) {
  return getOppTagsFromRecord(opp).some((t) => tagsEqual(t, tagTitle, catalog));
}

function oppMatchesSelectedTags(opp, selectedTags, catalog = buildTagCatalog()) {
  if (!selectedTags?.length) return true;
  return selectedTags.some((sel) => oppHasTag(opp, sel, catalog));
}

async function enrichOpportunitiesTags(items) {
  const needTags = items.filter((o) => getOppTagsFromRecord(o).length === 0);
  if (!needTags.length) return items;
  // Check cache first
  const uncached = [];
  for (const opp of needTags) {
    const id = opp.id ?? opp.ID;
    if (id != null) {
      const cached = state.oppTagCache?.get(id);
      if (cached) {
        opp.tags = cached;
        continue;
      }
    }
    uncached.push(opp);
  }
  if (!uncached.length) return items;
  await Promise.allSettled(
    uncached.map(async (opp) => {
      const id = opp.id ?? opp.ID;
      if (id == null) return;
      try {
        const tags = unwrapEntityTags(await api(`/api/2.0/crm/opportunity/tag/${id}`));
        if (tags.length) {
          opp.tags = tags;
          state.oppTagCache?.set(id, tags);
        }
      } catch {
        /* no tags on this deal */
      }
    })
  );
  return items;
}

async function fetchOpportunitiesForGroup(group) {
  const baseQs = buildFilterQuery(group);
  const catalog = buildTagCatalog();
  // Filter result cache (30s TTL): keyed only by server-side params (groupId + baseQs).
  // TagTitles and showOnlyRed are client-side filters that don't affect the API response.
  const cacheKey = `${group.id}::${baseQs}`;
  const cached = state.filterResultCache?.get(cacheKey);
  if (cached) {
    // Cache hit: raw opps from cache, re-apply tag enrichment (from tag cache) + client-side filters
    let items = cached;
    if (group.tagTitles?.length || group.groupBy === "tag") {
      items = await enrichOpportunitiesTags(items);
    }
    if (group.tagTitles?.length) {
      items = items.filter((o) => oppMatchesSelectedTags(o, group.tagTitles, catalog));
    }
    if (group.showOnlyRedOpportunities) {
      items = items.filter(isRedOpportunity);
    }
    return items;
  }
  const data = await api(`/api/2.0/crm/opportunity/filter?${baseQs}`);
  const rawItems = unwrap(data);
  // Cache the raw API response before any client-side filtering (so tag/filter changes don't miss the cache)
  state.filterResultCache?.set(cacheKey, rawItems);
  let items = rawItems;

  if (group.tagTitles?.length || group.groupBy === "tag") {
    items = await enrichOpportunitiesTags(items);
  }

  if (group.tagTitles?.length) {
    items = items.filter((o) => oppMatchesSelectedTags(o, group.tagTitles, catalog));
  }

  if (group.showOnlyRedOpportunities) {
    items = items.filter(isRedOpportunity);
  }

  return items;
}

function opportunityDueDateRaw(opp) {
  return (
    opp.expectedCloseDate?.value ??
    opp.expectedCloseDate ??
    opp.ExpectedCloseDate?.value ??
    opp.ExpectedCloseDate ??
    null
  );
}

function oppDueDateMs(opp) {
  return new Date(opportunityDueDateRaw(opp) || 0).getTime();
}

function formatOppDueLabel(opp) {
  const raw = opportunityDueDateRaw(opp);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dueDateToInputValue(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toApiExpectedCloseDate(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** CRM ApiDateTime values in PUT bodies are ISO strings (see OnlyOffice community examples). */
function crmDateTimeFromApi(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw.value ?? raw.Value ?? null;
  return String(raw);
}

function serializeCrmTimestamp(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function bustCache(path) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_t=${Date.now()}`;
}

async function fetchOpportunityForUpdate(oppId, force = false) {
  const data = await api(force ? bustCache(`/api/2.0/crm/opportunity/${oppId}`) : `/api/2.0/crm/opportunity/${oppId}`);
  return data?.response ?? data?.result ?? data;
}

function buildOpportunityPutBody(opp, overrides = {}) {
  const oppId = Number(opp.id ?? opp.ID);
  const members = [];
  if (Array.isArray(opp.members)) {
    for (const m of opp.members) {
      const mid = m.id ?? m.ID;
      if (mid != null) members.push(Number(mid));
    }
  }

  const accessList = [];
  if (Array.isArray(opp.accessList)) {
    for (const u of opp.accessList) {
      const uid = u.id ?? u.ID;
      if (uid != null) accessList.push(String(uid));
    }
  }

  const responsible = opp.responsible?.id ?? opp.responsible?.ID ?? state.currentUserId;

  const body = {
    opportunityid: oppId,
    contactid: Number(opp.contact?.id ?? opp.contact?.ID ?? opp.contactId ?? 0) || 0,
    members,
    title: opp.title || opp.Title || "",
    description: opp.description ?? opp.Description ?? "",
    responsibleid: String(responsible || ""),
    bidType: Number(opp.bidType ?? opp.BidType ?? 0),
    bidValue: Number(opp.bidValue ?? opp.BidValue ?? 0),
    bidCurrencyAbbr:
      opp.bidCurrency?.abbreviation ?? opp.bidCurrency?.Abbreviation ?? opp.bidCurrencyAbbr ?? "USD",
    perPeriodValue: Number(opp.perPeriodValue ?? opp.PerPeriodValue ?? 1),
    stageid: Number(opp.stage?.id ?? opp.stage?.ID ?? opp.stageId ?? 0),
    successProbability: Number(
      opp.successProbability ?? opp.SuccessProbability ?? opp.stage?.successProbability ?? 0
    ),
    actualCloseDate: crmDateTimeFromApi(opp.actualCloseDate ?? opp.ActualCloseDate),
    expectedCloseDate: crmDateTimeFromApi(opp.expectedCloseDate ?? opp.ExpectedCloseDate),
    isPrivate: !!(opp.isPrivate ?? opp.IsPrivate),
    accessList,
    isNotify: false,
  };

  if (overrides.expectedCloseDate !== undefined) body.expectedCloseDate = overrides.expectedCloseDate;
  if (overrides.stageid !== undefined) body.stageid = overrides.stageid;
  if (overrides.successProbability !== undefined) {
    body.successProbability = overrides.successProbability;
  }
  return body;
}

async function updateOpportunityDueDate(oppId, dateInputValue) {
  const opp = await fetchOpportunityForUpdate(oppId);
  const body = buildOpportunityPutBody(opp, {
    expectedCloseDate: dateInputValue ? serializeCrmTimestamp(dateInputValue) : null,
  });
  const res = await withCrmQueueOnTransient(
    () => api(`/api/2.0/crm/opportunity/${oppId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      showCrashBanner: false,
    }),
    {
      method: "PUT",
      path: `/api/2.0/crm/opportunity/${oppId}`,
      body: JSON.stringify(body),
      description: `Update due date for opportunity ${oppId}`,
      opType: "due",
      targetId: String(oppId),
    }
  );
  if (res && res.queued) return;
}

async function updateOpportunityStage(oppId, stageId) {
  const sid = Number(stageId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error("Invalid stage");

  const stage = state.stages.find((s) => Number(s.id ?? s.ID) === sid);
  const opp = await fetchOpportunityForUpdate(oppId);
  const overrides = { stageid: sid };
  const stageProb = stage?.successProbability ?? stage?.SuccessProbability;
  if (stageProb != null && !Number.isNaN(Number(stageProb))) {
    overrides.successProbability = Number(stageProb);
  }

  const body = buildOpportunityPutBody(opp, overrides);
  const res = await withCrmQueueOnTransient(
    () => api(`/api/2.0/crm/opportunity/${oppId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      showCrashBanner: false,
    }),
    {
      method: "PUT",
      path: `/api/2.0/crm/opportunity/${oppId}`,
      body: JSON.stringify(body),
      description: `Change stage for opportunity ${oppId}`,
      opType: "stage",
      targetId: String(oppId),
    }
  );
  if (res && res.queued) return;
}

async function addOpportunityTag(oppId, tagTitle) {
  const tagName = normalizeTagTitle(tagTitle);
  if (!tagName) return;
  const body = JSON.stringify({ tagName });
  const res = await withCrmQueueOnTransient(
    () => api(`/api/2.0/crm/opportunity/${oppId}/tag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      showCrashBanner: false,
    }),
    {
      method: "POST",
      path: `/api/2.0/crm/opportunity/${oppId}/tag`,
      body,
      description: `Add tag to opportunity ${oppId}`,
      opType: "tag",
      targetId: String(oppId),
    }
  );
  if (res && res.queued) return;
}

async function removeOpportunityTag(oppId, tagTitle) {
  const tagName = normalizeTagTitle(tagTitle);
  if (!tagName) return;
  const body = JSON.stringify({ tagName });
  const res = await withCrmQueueOnTransient(
    () => api(`/api/2.0/crm/opportunity/${oppId}/tag`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body,
      showCrashBanner: false,
    }),
    {
      method: "DELETE",
      path: `/api/2.0/crm/opportunity/${oppId}/tag`,
      body,
      description: `Remove tag from opportunity ${oppId}`,
      opType: "tag",
      targetId: String(oppId),
    }
  );
  if (res && res.queued) return;
}

async function loadHistoryCategories() {
  if (state.historyCategories.length) return state.historyCategories;
  try {
    const data = await api("/api/2.0/crm/history/category");
    state.historyCategories = unwrap(data);
  } catch {
    state.historyCategories = [];
  }

  if (!state.historyCategories.length) {
    try {
      const params = new URLSearchParams({
        startIndex: "0",
        count: "80",
        entityType: "opportunity",
      });
      const data = await api(`/api/2.0/crm/history/filter?${params}`);
      const byId = new Map();
      for (const ev of unwrapHistoryEvents(data)) {
        const cat = ev.category ?? ev.Category;
        const id = cat?.id ?? cat?.ID;
        if (id == null) continue;
        byId.set(Number(id), {
          id,
          title: cat.title || cat.Title || `Category ${id}`,
        });
      }
      state.historyCategories = [...byId.values()];
    } catch {
      /* no categories */
    }
  }

  return state.historyCategories;
}

function resolveHistoryCategoryId(selectedValue) {
  const picked = Number(selectedValue);
  if (Number.isFinite(picked) && picked > 0) return picked;

  const cats = state.historyCategories;
  const preferred = cats.find((c) => /note|event|comment/i.test(String(c.title || c.Title || "")));
  if (preferred) return Number(preferred.id ?? preferred.ID);

  const first = cats[0];
  if (first) return Number(first.id ?? first.ID);

  throw new Error(
    "No event note category found in CRM. Configure history categories under CRM settings, then try again."
  );
}

function populateHistoryCategorySelect(selectEl, fieldWrapEl) {
  if (!selectEl) return;

  selectEl.innerHTML = "";
  const cats = state.historyCategories;
  if (!cats.length) {
    if (fieldWrapEl) fieldWrapEl.classList.add("hidden");
    return;
  }

  if (fieldWrapEl) fieldWrapEl.classList.toggle("hidden", cats.length <= 1);

  for (const cat of cats) {
    const opt = document.createElement("option");
    opt.value = String(cat.id ?? cat.ID ?? "");
    opt.textContent = cat.title || cat.Title || opt.value;
    selectEl.appendChild(opt);
  }

  const preferred = cats.findIndex((c) => /note|event|comment/i.test(String(c.title || c.Title || "")));
  selectEl.selectedIndex = preferred >= 0 ? preferred : 0;
}

function populateDealEditNoteCategorySelect() {
  populateHistoryCategorySelect($("#deal-edit-note-category"), $("#deal-edit-note-category-field"));
}

function populateQuickNoteCategorySelect() {
  populateHistoryCategorySelect($("#quick-note-note-category"), $("#quick-note-note-category-field"));
}

function dealEditStepError(step, err) {
  const msg = err?.message || String(err);
  return new Error(`${step}: ${msg}`);
}

function dealTagsChanged(initialTags, nextTags) {
  const catalog = buildTagCatalog();
  const initialKeys = new Set(initialTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));
  const nextKeys = new Set(nextTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));
  if (initialKeys.size !== nextKeys.size) return true;
  for (const k of nextKeys) if (!initialKeys.has(k)) return true;
  return false;
}

function resolveOppStageId(opp) {
  return opp.stage?.id ?? opp.stage?.ID ?? opp.stageId ?? opp.StageId ?? "";
}

/** Due today or earlier — matches CRM “red” overdue opportunities. */
function isRedOpportunity(opp) {
  const raw = opportunityDueDateRaw(opp);
  if (raw == null || raw === "") return false;
  const due = new Date(raw);
  if (Number.isNaN(due.getTime())) return false;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return dueDay <= today;
}

function oppCreatedMs(opp) {
  const d =
    opp.createOn?.value ??
    opp.createOn ??
    opp.created ??
    opp.Created ??
    opp.dateAndTime?.value ??
    opp.dateAndTime;
  return new Date(d || 0).getTime();
}

function isOpenOpportunity(opp) {
  const st = opp.stage?.status ?? opp.stage?.stageType;
  if (st === 1 || st === 2 || st === "ClosedAndWon" || st === "ClosedAndLost") return false;
  return st === 0 || st === "Open" || st == null || st === "";
}

function countOpenOpportunities() {
  const seen = new Set();
  let n = 0;
  for (const group of state.groups) {
    for (const opp of group.opportunities || []) {
      const id = opp.id ?? opp.ID;
      if (id == null || seen.has(String(id))) continue;
      if (!isOpenOpportunity(opp)) continue;
      seen.add(String(id));
      n += 1;
    }
  }
  return n;
}

function applyClientDealStatus(opportunities, dealStatus) {
  if (dealStatus === "all") return opportunities;
  return opportunities.filter((opp) => {
    if (dealStatus === "open") return isOpenOpportunity(opp);
    if (dealStatus === "closed") return !isOpenOpportunity(opp);
    return true;
  });
}

function buildFilterQuery(group) {
  const params = new URLSearchParams();
  params.set("startIndex", "0");
  params.set("count", "500");

  if (group.search?.trim()) params.set("filterValue", group.search.trim());

  if (group.stageType !== "") params.set("stageType", group.stageType);
  else if (group.dealStatus === "open") params.set("stageType", "0");

  if (group.stageId) params.set("opportunityStagesid", group.stageId);

  /* Tag filter is applied client-side (OR). API tag params use AND and often return no rows. */

  if (group.contactId) params.set("contactid", group.contactId);

  if (group.sortBy) params.set("sortBy", group.sortBy);
  if (group.sortOrder) params.set("sortOrder", group.sortOrder);

  return params.toString();
}

function sortCards(items, group) {
  const sortBy = group.sortBy || "stage";
  const desc = group.sortOrder === "descending";
  const mul = desc ? -1 : 1;
  const stageOrder = new Map(state.stages.map((s, i) => [Number(s.id), i]));

  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "title":
        cmp = (a.title || "").localeCompare(b.title || "");
        break;
      case "bidvalue":
        cmp = (a.bidValue || 0) - (b.bidValue || 0);
        break;
      case "dateandtime": {
        cmp = oppDueDateMs(a) - oppDueDateMs(b);
        break;
      }
      case "created": {
        cmp = oppCreatedMs(a) - oppCreatedMs(b);
        break;
      }
      default: {
        const sa = stageOrder.get(Number(a.stage?.id)) ?? 999;
        const sb = stageOrder.get(Number(b.stage?.id)) ?? 999;
        cmp = sa - sb;
        if (cmp === 0) cmp = (a.title || "").localeCompare(b.title || "");
      }
    }
    return cmp * mul;
  });
}

function stageTypeKey(opp) {
  const st = opp.stage?.status ?? opp.stage?.stageType;
  if (st === 0 || st === "Open") return "open";
  if (st === 1 || st === "ClosedAndWon") return "won";
  if (st === 2 || st === "ClosedAndLost") return "lost";
  return "other";
}

function groupOpportunities(group) {
  const sorted = sortCards(group.opportunities, group);
  const groupBy = group.groupBy;

  if (groupBy === "stage") {
    ensureVisibleStageIds(group);
    const columns = state.stages
      .filter((s) => isStageColumnVisible(group, s.id))
      .map((s) => ({
        id: Number(s.id),
        title: s.title,
        color: (group.stageColors && group.stageColors[String(s.id)]) || s.color || "#4f8cff",
        items: [],
        stageId: Number(s.id),
        empty: true,
      }));
    const byId = new Map(columns.map((c) => [c.stageId, c]));

    for (const opp of sorted) {
      const sid = Number(opp.stage?.id ?? opp.stage?.ID);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      const col = byId.get(sid);
      if (col) {
        col.items.push(opp);
        col.empty = false;
      }
    }

    if (group.showEmptyStages === false) {
      return columns.filter((c) => c.items.length > 0);
    }
    return columns;
  }

  if (groupBy === "tag") {
    const selected = (group.tagTitles || []).map(normalizeTagTitle).filter(Boolean);
    const columns = [];

    const columnTitle = (tag) => {
      const known = state.allTags.find((t) => tagsEqual(t.title || t, tag));
      return known?.title || tag;
    };

    if (selected.length > 0) {
      const catalog = buildTagCatalog();
      const byTag = new Map();
      for (const tag of selected) {
        const key = tagLookupKey(tag, catalog);
        const col = { id: tag, title: columnTitle(tag), color: "#4f8cff", items: [], stageId: null };
        byTag.set(key, col);
        columns.push(col);
      }
      for (const opp of sorted) {
        for (const sel of selected) {
          if (!oppHasTag(opp, sel, catalog)) continue;
          const col = byTag.get(tagLookupKey(sel, catalog));
          if (col) col.items.push(opp);
        }
      }
      return columns;
    }

    const map = new Map();
    const untagged = {
      id: "_untagged",
      title: "Untagged",
      color: "#8b95a8",
      items: [],
      stageId: null,
    };
    map.set("_untagged", untagged);

    for (const opp of sorted) {
      const tags = getOppTags(opp);
      if (!tags.length) {
        untagged.items.push(opp);
        continue;
      }
      for (const tag of tags) {
        const key = normalizeTagTitle(tag).toLowerCase();
        if (!map.has(key)) {
          map.set(key, { id: tag, title: columnTitle(tag), color: "#4f8cff", items: [], stageId: null });
        }
        map.get(key).items.push(opp);
      }
    }

    const out = [...map.values()].filter((c) => c.items.length > 0);
    return out.sort((a, b) => {
      if (a.id === "_untagged") return 1;
      if (b.id === "_untagged") return -1;
      return a.title.localeCompare(b.title);
    });
  }

  const order = [
    { key: "open", title: "Open", color: "#4f8cff" },
    { key: "won", title: "Closed & won", color: "#3ecf8e" },
    { key: "lost", title: "Closed & lost", color: "#f07178" },
  ];
  const map = new Map(order.map((o) => [o.key, { ...o, items: [], stageId: null }]));
  for (const opp of sorted) {
    const k = stageTypeKey(opp);
    if (map.has(k)) map.get(k).items.push(opp);
  }
  return order.map((o) => map.get(o.key)).filter((g) => g.items.length > 0);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function formatMoney(opp) {
  if (!opp.bidValue) return null;
  const currency = opp.bidCurrency?.abbreviation || opp.bidCurrency?.symbol || "";
  return `${Number(opp.bidValue).toLocaleString()} ${currency}`.trim();
}

function customFieldLabel(field) {
  return normalizeTagTitle(
    field?.label ?? field?.Label ?? field?.title ?? field?.Title ?? field?.name ?? field?.fieldTitle
  );
}

function customFieldTypeCode(def) {
  const ft = def?.fieldType ?? def?.FieldType ?? def?.fieldTypeTitle ?? def?.FieldTypeTitle;
  if (typeof ft === "number" && ft >= 0 && ft <= 5) return ft;
  if (typeof ft === "string") {
    const s = ft.toLowerCase().replace(/\s+/g, "");
    if (s.includes("textarea")) return 1;
    if (s.includes("selectbox") || s === "select") return 2;
    if (s.includes("checkbox") || s === "check") return 3;
    if (s.includes("heading") || s === "head") return 4;
    if (s.includes("date")) return 5;
    if (s.includes("textfield") || s === "text") return 0;
  }
  return 0;
}

/** User fields hidden from the create-opportunity modal (still exist in CRM). */
const CREATE_OPP_EXCLUDED_USER_FIELDS = new Set(
  [
    "Same Adjuster",
    "Photo Drive Link",
    "Shared Spreadsheet",
    "Trades",
    "Final RCV",
    "Zip Code",
    "State",
    "City",
    "Members",
    "Member",
  ].map((n) => normalizeUserFieldLabelKey(n))
);

function normalizeUserFieldLabelKey(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isCreateOppExcludedUserField(def) {
  const label = customFieldLabel(def);
  if (!label) return false;
  const key = normalizeUserFieldLabelKey(label);
  if (CREATE_OPP_EXCLUDED_USER_FIELDS.has(key)) return true;
  if (key === "members" || key === "member") return true;
  return false;
}

function fieldNameMatches(label, patterns) {
  const l = label.toLowerCase();
  return patterns.some((p) => {
    const pat = p.toLowerCase();
    return l === pat || l.includes(pat) || pat.includes(l);
  });
}

async function loadOpportunityCustomFieldDefs(force = false) {
  if (!force && state.customFieldDefs.length) return state.customFieldDefs;

  state.customFieldDefs = [];
  state.customFieldById = new Map();
  // Only opportunity definitions IDs are valid Keys for create/update (see CRMApi.Deals.cs).
  const paths = ["/api/2.0/crm/opportunity/customfield/definitions"];
  for (const path of paths) {
    try {
      const list = unwrap(await api(path));
      if (list.length) {
        state.customFieldDefs = list
          .slice()
          .sort((a, b) => (a.position ?? a.Position ?? 0) - (b.position ?? b.Position ?? 0));
        for (const f of state.customFieldDefs) {
          const id = customFieldDefinitionId(f);
          if (id != null) state.customFieldById.set(String(id), f);
        }
        return state.customFieldDefs;
      }
    } catch {
      /* try next path */
    }
  }
  return state.customFieldDefs;
}

const CHECKLIST_STAGE_TITLE = "New Supplement Project - Estimate Needed";

function findCustomFieldEntry(opp, ...namePatterns) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
      const def = fieldId != null ? state.customFieldById.get(String(fieldId)) : null;
      const label = customFieldLabel(item) || customFieldLabel(def);
      if (!label || !fieldNameMatches(label, namePatterns)) continue;
      return item;
    }
  }

  for (const def of state.customFieldDefs) {
    if (!fieldNameMatches(customFieldLabel(def), namePatterns)) continue;
    const fieldId = def.id ?? def.ID;
    const key = fieldId != null ? String(fieldId) : null;
    if (key && opp[key] != null && opp[key] !== "") {
      return { value: opp[key], fieldId };
    }
  }

  return null;
}

function isCustomFieldChecked(opp, ...namePatterns) {
  const entry = findCustomFieldEntry(opp, ...namePatterns);
  if (!entry) return false;

  const fieldId = entry.id ?? entry.ID ?? entry.fieldId ?? entry.FieldId;
  const def = fieldId != null ? state.customFieldById.get(String(fieldId)) : null;
  const raw = entry.value ?? entry.Value ?? entry.fieldValue ?? entry.FieldValue;

  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;

  const text = String(raw).trim().toLowerCase();
  if (!text) return false;
  if (text === "true" || text === "yes" || text === "1" || text === "checked" || text === "on") return true;
  if (text === "false" || text === "no" || text === "0" || text === "unchecked" || text === "off") return false;

  const fieldType = String(def?.fieldType ?? def?.type ?? def?.fieldTypeTitle ?? "").toLowerCase();
  if (fieldType.includes("check") || fieldType.includes("bool")) {
    return true;
  }

  return true;
}

function isChecklistStage(opp) {
  const title = (opp.stage?.title || "").trim().toLowerCase();
  return title === CHECKLIST_STAGE_TITLE.toLowerCase();
}

function needsMissingChecklistWarning(opp) {
  if (!isChecklistStage(opp)) return false;
  return opportunityChecklistFieldLabels().some((name) => !isCustomFieldChecked(opp, name));
}

function getOppCustomFieldValue(opp, ...namePatterns) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
      const def = fieldId != null ? state.customFieldById.get(String(fieldId)) : null;
      const label = customFieldLabel(item) || customFieldLabel(def);
      if (!label || !fieldNameMatches(label, namePatterns)) continue;
      const raw = item.value ?? item.Value ?? item.fieldValue ?? item.FieldValue;
      if (raw == null || raw === "") return "";
      if (typeof raw === "object") {
        return normalizeTagTitle(raw.title ?? raw.text ?? raw.value ?? raw.Value);
      }
      return String(raw).trim();
    }
  }

  for (const def of state.customFieldDefs) {
    if (!fieldNameMatches(customFieldLabel(def), namePatterns)) continue;
    const fieldId = def.id ?? def.ID;
    const key = fieldId != null ? String(fieldId) : null;
    if (key && opp[key] != null && opp[key] !== "") return String(opp[key]).trim();
  }

  return "";
}

function appendCardDetailLine(container, label, value) {
  const line = document.createElement("p");
  line.className = "card-detail-line";
  if (label) {
    const strong = document.createElement("span");
    strong.className = "card-detail-label";
    strong.textContent = `${label}: `;
    line.appendChild(strong);
  }
  line.appendChild(document.createTextNode(value));
  container.appendChild(line);
}

const CARD_ICON_PREVIEW_SCREEN = `<svg class="card-action-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;

/** Bookmark ribbon SVG — outline (not bookmarked) vs filled (bookmarked). */
function bookmarkRibbonSvg(filled = false) {
  const fillAttr = filled ? 'currentColor' : 'none';
  return `<svg class="bookmark-ribbon-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${fillAttr}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
}

function renderCard(opp, group, showStagePill) {
  const card = document.createElement("article");
  card.className = "card" + (oppHasTag(opp, "High Priority") ? " card--high-priority" : "");
  card.dataset.opportunityId = opp.id;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "card-preview-btn";
  previewBtn.title = "Preview deal";
  previewBtn.setAttribute("aria-label", "Preview deal");
  previewBtn.innerHTML = CARD_ICON_PREVIEW_SCREEN;
  previewBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = opp.id ?? opp.ID;
    openOpportunityPreviewModal(id, opp.title || opp.Title || "", group).catch((err) =>
      showToast(err.message, true)
    );
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "card-edit-btn";
  editBtn.title = "Edit deal";
  editBtn.setAttribute("aria-label", "Edit deal");
  editBtn.textContent = "✎";
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDealEditModal(opp, group).catch((err) => showToast(err.message, true));
  });

  actions.appendChild(previewBtn);
  actions.appendChild(editBtn);
  card.appendChild(actions);

  const title = document.createElement("h3");
  title.className = "card-title";
  const link = document.createElement("a");
  link.className = "card-title-link";
  link.href = crmOpportunityUrl(opp.id);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = opp.title || "(Untitled)";
  title.appendChild(link);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const money = formatMoney(opp);
  if (money) {
    const v = document.createElement("span");
    v.className = "card-value";
    v.textContent = money;
    meta.appendChild(v);
  }

  const details = document.createElement("div");
  details.className = "card-details";

  const contactName = getOpportunityContactLabel(opp);
  if (contactName) {
    const contactEl = document.createElement("p");
    contactEl.className = "card-contact";
    contactEl.textContent = contactName;
    details.appendChild(contactEl);
  }

  const description = (opp.description || opp.Description || "").trim();
  if (description) {
    const desc = document.createElement("p");
    desc.className = "card-description";
    desc.textContent = description;
    details.appendChild(desc);
  }

  const customFieldsReady = opportunityHasCustomFieldLists(opp);
  if (customFieldsReady) {
    const crmJobId = getOppCustomFieldValue(opp, "crm job/id", "crm job", "job/id");
    if (crmJobId) appendCardDetailLine(details, "CRM Job/ID", crmJobId);

    const insuranceCarrier = getOppCustomFieldValue(opp, "insurance carrier");
    if (insuranceCarrier) appendCardDetailLine(details, "Insurance Carrier", insuranceCarrier);

    const supplementRequest = getOppCustomFieldValue(opp, "supplement request");
    if (!supplementRequest) {
      appendCardDetailLine(details, null, "No Supp Request");
    }
  }

  card.appendChild(title);
  if (meta.childElementCount) card.appendChild(meta);
  if (details.childElementCount) card.appendChild(details);

  if (showStagePill && opp.stage?.title) {
    const pill = document.createElement("span");
    pill.className = "card-stage-pill";
    pill.textContent = opp.stage.title;
    card.appendChild(pill);
  }

  if (customFieldsReady && needsMissingChecklistWarning(opp)) {
    const warn = document.createElement("p");
    warn.className = "card-checklist-warn";
    warn.textContent = "Missing Checklist info";
    card.appendChild(warn);
  }

  const dueLabel = formatOppDueLabel(opp);
  if (dueLabel) {
    const due = document.createElement("p");
    due.className = "card-due" + (isRedOpportunity(opp) ? " card-due--overdue" : "");
    due.textContent = `Due ${dueLabel}`;
    card.appendChild(due);
  }

  // Bookmark ribbon button (bottom-right)
  const oppId = opp.id ?? opp.ID;
  const isBookmarked = isDealBookmarked(oppId);
  const bookmarkBtn = document.createElement("button");
  bookmarkBtn.type = "button";
  bookmarkBtn.className = "card-bookmark-btn" + (isBookmarked ? " bookmarked" : "");
  bookmarkBtn.title = isBookmarked ? "Remove bookmark" : "Bookmark deal";
  bookmarkBtn.setAttribute("aria-label", bookmarkBtn.title);
  bookmarkBtn.dataset.oppId = oppId;
  bookmarkBtn.innerHTML = bookmarkRibbonSvg(isBookmarked);
  bookmarkBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = Number(opp.id ?? opp.ID);
    if (isDealBookmarked(id)) {
      removeBookmarkDeal(id);
    } else {
      addBookmarkDeal(id, opp.title || opp.Title || "");
    }
  });
  card.appendChild(bookmarkBtn);

  return card;
}

function renderGroupBoard(group, container) {
  disconnectGroupCardObserver(group.id);
  container.innerHTML = "";
  const columns = groupOpportunities(group);
  const showStagePill = group.groupBy !== "stage";

  if (!columns.length) {
    container.innerHTML = '<p class="board-loading">No opportunities match this group’s filters.</p>';
    return;
  }

  for (const col of columns) {
    const column = document.createElement("section");
    column.className = "column" + (col.items.length === 0 ? " column-empty" : "");
    if (col.stageId != null) column.dataset.stageId = String(col.stageId);

    const header = document.createElement("div");
    header.className = "column-header";
    header.innerHTML = `
      <span class="column-dot" style="background:${escapeHtml(col.color)}"></span>
      <span class="column-title">${escapeHtml(col.title)}</span>
      <span class="column-count">${col.items.length}</span>
    `;

    // Color editing for stage columns (CRM stages), matching local kanban column color picker UX.
    // Only for actual stage columns (have stageId). Title from CRM is fixed; only color override per-group.
    if (col.stageId != null) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "group-col-edit btn btn-ghost btn-tiny";
      editBtn.title = "Edit stage column color";
      editBtn.style.cssText = "padding:0 3px; margin-left:2px;";
      editBtn.textContent = "✎";
      header.appendChild(editBtn);

      editBtn.addEventListener("click", e => {
        e.stopPropagation();
        const dotSpan = header.querySelector(".column-dot");
        const titleSpan = header.querySelector(".column-title");
        const origColor = col.color || "#4f8cff";
        if (dotSpan) dotSpan.style.display = "none";
        const editWrap = document.createElement("span");
        editWrap.style.display = "inline-flex";
        editWrap.style.gap = "2px";
        editWrap.style.alignItems = "center";
        editWrap.innerHTML = `
          <input type="color" value="${origColor}" style="width:16px;height:14px;padding:0;border:0;" />
          <button class="btn btn-ghost btn-tiny" style="padding:0 1px;font-size:0.6rem;">✓</button>
          <button class="btn btn-ghost btn-tiny" style="padding:0 1px;font-size:0.6rem;">✕</button>
        `;
        header.insertBefore(editWrap, titleSpan);
        const colorIn = editWrap.querySelector("input");
        const [okBtn, cancelBtn] = editWrap.querySelectorAll("button");
        const clean = () => {
          if (dotSpan) dotSpan.style.display = "";
          editWrap.remove();
        };
        const doSave = () => {
          if (!group.stageColors) group.stageColors = {};
          group.stageColors[String(col.stageId)] = colorIn.value;
          saveGroupsToStorage();
          scheduleUserProfileSave();
          renderGroupBoard(group, container);
          clean();
        };
        okBtn.onclick = doSave;
        cancelBtn.onclick = clean;
        // focus the color input (user can click to open picker)
        colorIn.focus();
      });
    }

    const body = document.createElement("div");
    body.className = "column-body";

    if (!col.items.length) {
      body.innerHTML = '<p class="empty-column">No deals</p>';
    } else {
      for (const opp of col.items) {
        body.appendChild(renderCard(opp, group, showStagePill));
      }
    }

    column.appendChild(header);
    column.appendChild(body);
    container.appendChild(column);
  }
  observeOpportunityCardsInGroup(group);
}

function tagMultiselectLabel(group) {
  const n = (group.tagTitles || []).length;
  if (n === 0) return "All tags";
  if (n === 1) return group.tagTitles[0];
  if (n <= 2) return group.tagTitles.join(", ");
  return `${n} tags selected`;
}

function stageColumnsLabel(group) {
  ensureVisibleStageIds(group);
  const n = group.stageColumnsConfigured ? group.visibleStageIds.length : state.stages.length;
  const total = state.stages.length;
  if (!total) return "No stages";
  if (!group.stageColumnsConfigured || n >= total) return "All stages";
  if (n === 0) return "No stages selected";
  if (n <= 2) {
    return group.visibleStageIds
      .map((id) => state.stages.find((s) => String(s.id) === String(id))?.title || id)
      .join(", ");
  }
  return `${n} stages`;
}

function syncStageGroupFiltersUI(section, group) {
  const show = group.groupBy === "stage";
  $(".stage-columns-field", section)?.classList.toggle("hidden", !show);
  $(".stage-empty-field", section)?.classList.toggle("hidden", !show);
}

function renderStageColumnsMultiselect(group, container) {
  container.innerHTML = "";
  ensureVisibleStageIds(group);

  const wrap = document.createElement("div");
  wrap.className = "multiselect";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "multiselect-trigger";
  trigger.textContent = stageColumnsLabel(group);

  const panel = document.createElement("div");
  panel.className = "multiselect-panel hidden";

  const updateTrigger = () => {
    trigger.textContent = stageColumnsLabel(group);
  };

  if (!state.stages.length) {
    panel.innerHTML = '<span style="padding:0.4rem;font-size:0.75rem;color:var(--muted)">No pipeline stages</span>';
  } else {
    for (const stage of state.stages) {
      const sid = String(stage.id);
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isStageColumnVisible(group, sid);
      cb.addEventListener("change", () => {
        if (!group.stageColumnsConfigured) {
          group.stageColumnsConfigured = true;
          group.visibleStageIds = state.stages.map((s) => String(s.id));
        }
        if (cb.checked) {
          if (!group.visibleStageIds.includes(sid)) group.visibleStageIds.push(sid);
        } else {
          group.visibleStageIds = group.visibleStageIds.filter((id) => String(id) !== sid);
        }
        updateTrigger();
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        renderGroupBoard(group, groupDomEl(group) && $(".board", groupDomEl(group)));
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(stage.title || `Stage ${sid}`));
      panel.appendChild(label);
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) panel.classList.add("hidden");
  });

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  container.appendChild(wrap);
}

function renderTagMultiselect(group, container) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "multiselect";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "multiselect-trigger";
  trigger.textContent = tagMultiselectLabel(group);

  const panel = document.createElement("div");
  panel.className = "multiselect-panel hidden";

  const updateTrigger = () => {
    trigger.textContent = tagMultiselectLabel(group);
  };

  if (!state.allTags.length) {
    panel.innerHTML = '<span style="padding:0.4rem;font-size:0.75rem;color:var(--muted)">No tags in CRM</span>';
  } else {
    for (const tag of state.allTags) {
      const title = tag.title || tag;
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (group.tagTitles || []).some((t) => tagsEqual(t, title));
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (!group.tagTitles.some((t) => tagsEqual(t, title))) group.tagTitles.push(title);
        } else {
          group.tagTitles = group.tagTitles.filter((t) => !tagsEqual(t, title));
        }
        if (group.tagTitles.length > 0) {
          group.groupBy = "tag";
          const groupBySel = groupDomEl(group) && $(".group-by", groupDomEl(group));
          if (groupBySel) groupBySel.value = "tag";
        }
        updateTrigger();
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        refreshGroup(group);
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(title));
      panel.appendChild(label);
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) panel.classList.add("hidden");
  });

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  container.appendChild(wrap);
}

async function searchContacts(query) {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({
    startIndex: "0",
    count: "25",
    filterValue: query,
    contactListView: "WithOpportunity",
  });
  const data = await api(`/api/2.0/crm/contact/filter?${params}`);
  return unwrap(data);
}

function bindContactField(group, wrap) {
  const input = $(".contact-search", wrap);
  const results = $(".contact-results", wrap);
  const selected = $(".contact-selected", wrap);
  let debounce;

  function updateSelectedUi() {
    if (group.contactId) {
      selected.innerHTML = `Contact: ${escapeHtml(group.contactLabel || "#" + group.contactId)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
      $(".contact-clear", selected)?.addEventListener("click", () => {
        group.contactId = "";
        group.contactLabel = "";
        input.value = "";
        updateSelectedUi();
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        refreshGroup(group);
      });
    } else {
      selected.textContent = "";
    }
  }

  updateSelectedUi();

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 2) {
        results.classList.add("hidden");
        return;
      }
      try {
        const contacts = await searchContacts(q);
        results.classList.remove("hidden");
        if (!contacts.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const c of contacts) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = c.displayName || c.title || `Contact #${c.id}`;
          btn.addEventListener("click", () => {
            group.contactId = String(c.id);
            group.contactLabel = btn.textContent;
            input.value = "";
            results.classList.add("hidden");
            saveGroupsToStorage();
            updateSelectedUi();
            updateGroupFilterSummary(group);
            refreshGroup(group);
          });
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 350);
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) results.classList.add("hidden");
  });
}

function renderBoardGroups() {
  renderFeedTile();
  renderTasksTile();
  renderPresenceTile();
  const dash = $("#dashboard-tiles");
  if (!dash) return;

  // Only remove actual group tiles here. Local kanban tiles (which share the board-group-tile
  // class for styling) are managed by their own render and would be duplicated or lost otherwise.
  dash.querySelectorAll(".board-group-tile:not(.local-kanban-tile)").forEach((el) => el.remove());

  for (const group of state.groups) {
    const tileId = `group-${group.id}`;
    const section = document.createElement("section");
    section.className = "dashboard-tile board-group board-group-tile";
    section.dataset.tileId = tileId;
    section.dataset.tileLabel = group.name || "Opportunity group";
    section.dataset.groupId = group.id;

    section.innerHTML = `
      <div class="board-group-header">
        <div class="group-filters-panel">
          <div class="group-filters">
            <div class="field">
              <span class="presets-label">Deals</span>
              <div class="toolbar-presets" style="margin:0">
                <button type="button" class="chip" data-status="all">All</button>
                <button type="button" class="chip" data-status="open">Open</button>
                <button type="button" class="chip" data-status="closed">Closed</button>
              </div>
            </div>
            <div class="field">
              <label>Group by</label>
              <select class="group-by">
                <option value="stage">Pipeline stage</option>
                <option value="tag">Tag</option>
                <option value="stageType">Open / won / lost</option>
              </select>
            </div>
            <div class="field">
              <label>Pipeline stage</label>
              <select class="stage-filter"><option value="">All stages</option></select>
            </div>
            <div class="field stage-columns-field hidden">
              <label>Stage columns</label>
              <div class="stage-columns-multiselect"></div>
            </div>
            <div class="field field-checkbox stage-empty-field hidden">
              <label class="checkbox-filter">
                <input type="checkbox" class="show-empty-stages" checked />
                <span>Show empty stages</span>
              </label>
            </div>
            <div class="field field-checkbox">
              <label class="checkbox-filter">
                <input type="checkbox" class="show-only-red" />
                <span>Show only red opportunities</span>
              </label>
            </div>
            <div class="field">
              <label>Tags</label>
              <div class="tag-multiselect"></div>
            </div>
            <div class="field contact-field">
              <label>Opportunity contact</label>
              <input type="search" class="contact-search" placeholder="Search name…" autocomplete="off" />
              <div class="contact-results hidden"></div>
              <div class="contact-selected"></div>
            </div>
            <div class="field">
              <label>Search</label>
              <input type="search" class="group-search" placeholder="Title…" />
            </div>
            <div class="field">
              <label>Sort by</label>
              <select class="group-sort-by">
                <option value="stage">Pipeline stage</option>
                <option value="title">Title</option>
                <option value="bidvalue">Bid value</option>
                <option value="dateandtime">Due date</option>
                <option value="created">Date created</option>
              </select>
            </div>
            <div class="field">
              <label>Order</label>
              <select class="group-sort-order">
                <option value="ascending">Oldest / A→Z first</option>
                <option value="descending">Newest / Z→A first</option>
              </select>
            </div>
          </div>
          <p class="group-filter-summary"></p>
        </div>
      </div>
      <main class="board"></main>
    `;

    updateGroupFilterSummary(group);

    section.querySelectorAll("[data-status]").forEach((btn) => {
      btn.classList.toggle("chip-active", btn.dataset.status === group.dealStatus);
      btn.addEventListener("click", () => {
        group.dealStatus = btn.dataset.status;
        section.querySelectorAll("[data-status]").forEach((b) => {
          b.classList.toggle("chip-active", b.dataset.status === group.dealStatus);
        });
        saveGroupsToStorage();
        refreshGroup(group);
      });
    });

    const groupBy = $(".group-by", section);
    groupBy.value = group.groupBy;
    groupBy.addEventListener("change", () => {
      group.groupBy = groupBy.value;
      if (group.groupBy === "stage") ensureVisibleStageIds(group);
      syncStageGroupFiltersUI(section, group);
      saveGroupsToStorage();
      updateGroupFilterSummary(group);
      renderGroupBoard(group, $(".board", section));
    });

    syncStageGroupFiltersUI(section, group);
    renderStageColumnsMultiselect(group, $(".stage-columns-multiselect", section));

    const showEmptyStages = $(".show-empty-stages", section);
    if (showEmptyStages) {
      showEmptyStages.checked = group.showEmptyStages !== false;
      showEmptyStages.addEventListener("change", () => {
        group.showEmptyStages = showEmptyStages.checked;
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        renderGroupBoard(group, $(".board", section));
      });
    }

    const showOnlyRed = $(".show-only-red", section);
    if (showOnlyRed) {
      showOnlyRed.checked = !!group.showOnlyRedOpportunities;
      showOnlyRed.addEventListener("change", () => {
        group.showOnlyRedOpportunities = showOnlyRed.checked;
        saveGroupsToStorage();
        updateGroupFilterSummary(group);
        refreshGroup(group);
      });
    }

    const stageFilter = $(".stage-filter", section);
    for (const s of state.stages) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.title;
      if (String(group.stageId) === String(s.id)) opt.selected = true;
      stageFilter.appendChild(opt);
    }
    stageFilter.addEventListener("change", () => {
      group.stageId = stageFilter.value;
      saveGroupsToStorage();
      refreshGroup(group);
    });

    $(".group-search", section).addEventListener("input", debounceForGroup(group, () => {
      group.search = $(".group-search", section).value;
      saveGroupsToStorage();
      refreshGroup(group);
    }));

    const sortBy = $(".group-sort-by", section);
    sortBy.value = group.sortBy || "stage";
    sortBy.addEventListener("change", () => {
      group.sortBy = sortBy.value;
      saveGroupsToStorage();
      renderGroupBoard(group, $(".board", section));
    });

    const sortOrder = $(".group-sort-order", section);
    sortOrder.value = group.sortOrder || "ascending";
    sortOrder.addEventListener("change", () => {
      group.sortOrder = sortOrder.value;
      saveGroupsToStorage();
      renderGroupBoard(group, $(".board", section));
    });

    renderTagMultiselect(group, $(".tag-multiselect", section));
    bindContactField(group, $(".contact-field", section));

    dash.appendChild(section);
    bindGroupTileChrome(section, group, tileId);
    group._el = section;
    if (tileBodyCollapsed(tileId)) {
      const board = $(".board", section);
      if (group.opportunities?.length && board) {
        renderGroupBoard(group, board);
        $(".board-group-count", section).textContent = `${group.opportunities.length} deals (cached)`;
      } else {
        showTileCollapsedHint(tileId, "Minimized — expand to load deals");
      }
    } else {
      renderGroupBoard(group, $(".board", section));
      $(".board-group-count", section).textContent = `${group.opportunities.length} deals`;
    }
    applyTileLayoutClasses(section, tileId);
    applyTileBodyCollapsed(section, tileId);
  }

  renderCalendarTiles(dash);
  renderNotesTiles(dash);
  renderLocalKanbanTiles(dash);

  ensureTileLayout();
  mountDashboardTiles();
  refreshDashboardTileLayouts();
}

function debounceForGroup(group, fn) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, 400);
  };
}

async function loadStages() {
  const data = await api("/api/2.0/crm/opportunity/stage");
  state.stages = unwrap(data).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function loadAllTags() {
  const data = await api("/api/2.0/crm/opportunity/tag");
  state.allTags = unwrap(data);
}

async function loadCurrentUser() {
  try {
    const data = await api("/api/2.0/people/@self");
    const me = data.response ?? data.result ?? data;
    state.currentUser = me && typeof me === "object" ? me : null;
    state.currentUserId =
      me?.id ?? me?.ID ?? me?.userId ?? me?.UserId ?? data?.id ?? data?.ID ?? null;
    state.currentUserName =
      me?.displayName || me?.DisplayName || me?.userName || me?.UserName || "";
    state.currentUserEmail = String(me?.email || me?.Email || me?.primaryEmail || me?.PrimaryEmail || "")
      .trim()
      .toLowerCase();
    return me;
  } catch {
    state.currentUser = null;
    state.currentUserId = null;
    state.currentUserName = "";
    state.currentUserEmail = "";
    return null;
  }
}

function currentUserIdentityTokens() {
  const tokens = new Set();
  if (state.currentUserId != null && state.currentUserId !== "") {
    tokens.add(String(state.currentUserId).toLowerCase());
  }
  const name = (state.currentUserName || "").trim().toLowerCase();
  if (name) tokens.add(name);
  const userName = (state.currentUser?.userName || state.currentUser?.UserName || "").trim().toLowerCase();
  if (userName) tokens.add(userName);
  const email = (state.currentUserEmail || "").trim().toLowerCase();
  if (email) tokens.add(email);
  return tokens;
}

/** CRM opportunity events when another user checks you under "notify user" (plus email). */
const CRM_NOTIFY_MARKERS = [
  /CRM\.\s*New event added to/i,
  /has added a new event to/i,
  /New event added to/i,
  /notified you/i,
  /notify user/i,
];

function parseNotifyNamesFromText(text) {
  const t = String(text || "");
  const out = [];
  const patterns = [
    /notify\s+users?\s*[:]\s*([^\n<]+)/i,
    /users?\s+to\s+notify\s*[:]\s*([^\n<]+)/i,
    /notified\s+users?\s*[:]\s*([^\n<]+)/i,
    /notify\s+user\s*[:]\s*([^\n<]+)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m?.[1]) continue;
    for (const part of m[1].split(/[,;]+/)) {
      const name = part.trim();
      if (name) out.push(name);
    }
  }
  return out;
}

function notifyRecipientsFromAdditionalData(raw) {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return parseNotifyNamesFromText(raw);
    }
  }
  if (!data || typeof data !== "object") return [];
  const out = [];
  const lists = [
    data.notifyUsers,
    data.NotifyUsers,
    data.notifyUserList,
    data.NotifyUserList,
    data.usersToNotify,
    data.UsersToNotify,
    data.notifyContacts,
    data.NotifyContacts,
    data.toUsers,
    data.ToUsers,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    out.push(...list);
  }
  return out;
}

function notifyRecipientsFromEvent(ev) {
  const out = [];
  const lists = [
    ev.notifyUsers,
    ev.NotifyUsers,
    ev.notifyUserList,
    ev.NotifyUserList,
    ev.usersToNotify,
    ev.UsersToNotify,
    ev.notifyContacts,
    ev.NotifyContacts,
    ev.toUsers,
    ev.ToUsers,
  ];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    out.push(...list);
  }
  out.push(...notifyRecipientsFromAdditionalData(ev.additionalData || ev.AdditionalData));
  out.push(...parseNotifyNamesFromText(ev.content || ev.Content || ""));
  return out;
}

function mailAddressesFromMessage(mail) {
  const out = [];
  const lists = [mail.to, mail.To, mail.cc, mail.Cc, mail.bcc, mail.Bcc, mail.recipients, mail.Recipients];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry === "string") out.push(entry);
      else if (entry) {
        out.push(entry.email || entry.Email || entry.address || entry.Address || entry.title || entry.Title);
      }
    }
  }
  const single = mail.address || mail.Address;
  if (single) out.push(single);
  return out.filter(Boolean).map((a) => String(a).toLowerCase());
}

function mailIsAddressedToCurrentUser(mail) {
  const addresses = mailAddressesFromMessage(mail);
  if (!addresses.length) return true;
  const tokens = currentUserIdentityTokens();
  if (!tokens.size) return false;
  return addresses.some((addr) => {
    for (const token of tokens) {
      if (addr === token || addr.includes(token) || token.includes(addr)) return true;
    }
    return false;
  });
}

function recipientMatchesCurrentUser(recipient) {
  if (recipient == null) return false;
  const tokens = currentUserIdentityTokens();
  if (!tokens.size) return false;
  if (typeof recipient === "string") {
    const s = recipient.toLowerCase();
    for (const token of tokens) {
      if (s === token || s.includes(token) || token.includes(s)) return true;
    }
    return sameUserId(recipient, state.currentUserId);
  }
  const id = recipient.id ?? recipient.ID ?? recipient.userId;
  if (id != null && sameUserId(id, state.currentUserId)) return true;
  const name = (recipient.displayName || recipient.title || "").toLowerCase();
  const userName = (recipient.userName || recipient.UserName || "").toLowerCase();
  const myName = (state.currentUserName || "").toLowerCase();
  const myUser = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  if (myName && name && name === myName) return true;
  if (myUser && userName && userName === myUser) return true;
  return false;
}

function normalizeCrmEntityType(raw) {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  if (n === 2) return "opportunity";
  if (n === 3) return "case";
  if (n === 1) return "contact";
  const s = String(raw).toLowerCase();
  if (s === "deal") return "opportunity";
  return s;
}

function unwrapHistoryEvents(data) {
  const direct = unwrap(data);
  if (direct.length) return direct;
  const r = data?.response;
  if (!r || typeof r !== "object") return [];
  for (const key of ["items", "Items", "events", "Events", "history", "History"]) {
    if (Array.isArray(r[key])) return r[key];
  }
  return [];
}

function parseRelationshipNotifyEvent(ev) {
  const entity = ev.entity || ev.Entity;
  const entityType = normalizeCrmEntityType(
    entity?.entityType ?? entity?.EntityType ?? ev.entityType ?? ev.EntityType
  );
  if (entityType && entityType !== "opportunity") return null;

  let id =
    entity?.entityId ??
    entity?.EntityId ??
    entity?.id ??
    entity?.ID ??
    ev.entityId ??
    ev.EntityId ??
    ev.entityID ??
    ev.EntityID ??
    ev.opportunityId;

  if (!id) {
    id = opportunityIdFromText(ev.content || ev.Content || "");
  }
  if (!id) return null;

  const title = String(
    entity?.entityTitle || entity?.EntityTitle || ev.opportunityTitle || `Opportunity #${id}`
  )
    .replace(/^CRM\.\s*New event added to\s+/i, "")
    .trim();

  const createBy = ev.createBy || ev.CreateBy || ev.createdBy || ev.CreatedBy;
  const authorId = createBy?.id ?? createBy?.ID ?? null;
  const author =
    createBy?.displayName ||
    createBy?.DisplayName ||
    displayNameForUserName(createBy?.userName || createBy?.UserName) ||
    "Another user";

  let text = toPlainDisplayText(ev.content ?? ev.Content ?? "");
  if (!text || isNotifyTemplateSpam(text)) {
    const catTitle = ev.category?.title || ev.Category?.title || ev.category?.Title;
    const catText = toPlainDisplayText(catTitle);
    if (catText && !isNotifyTemplateSpam(catText)) text = catText;
    else return null;
  }

  const date =
    ev.created?.value ??
    ev.created ??
    ev.Created?.value ??
    ev.Created ??
    ev.createOn?.value ??
    ev.createOn;

  return {
    id: Number(id),
    title,
    author,
    authorId,
    text,
    date,
    source: "history",
    notifyRecipients: notifyRecipientsFromEvent(ev),
  };
}

function indexOpportunity(opp) {
  const id = Number(opp?.id ?? opp?.ID);
  if (!Number.isFinite(id) || id <= 0) return;
  if (!state.opportunityById) state.opportunityById = new Map();
  state.opportunityById.set(id, opp);
}

function getOpportunityFromState(oppId) {
  const id = Number(oppId);
  if (!Number.isFinite(id)) return null;
  if (state.opportunityById?.has(id)) return state.opportunityById.get(id);
  for (const g of state.groups) {
    for (const o of g.opportunities || []) {
      if (Number(o.id ?? o.ID) === id) {
        indexOpportunity(o);
        return o;
      }
    }
  }
  return null;
}

function isCurrentUserOpportunityResponsible(opp) {
  if (!opp || state.currentUserId == null) return false;
  const respId =
    opp.responsible?.id ??
    opp.responsible?.ID ??
    opp.responsibleId ??
    opp.ResponsibleId ??
    opp.responsibleID;
  return respId != null && sameUserId(respId, state.currentUserId);
}

function isNotificationForLoggedInUser(item, ev = null) {
  const tokens = currentUserIdentityTokens();
  if (!tokens.size) return false;

  if (item.authorId && state.currentUserId != null && sameUserId(item.authorId, state.currentUserId)) {
    return false;
  }

  if (item.source === "mail") {
    if (item.forCurrentUser === false) return false;
    if (item.forCurrentUser === true) return true;
    return true;
  }

  const recipients = ev ? notifyRecipientsFromEvent(ev) : item.notifyRecipients || [];
  if (recipients.length) {
    return recipients.some((r) => recipientMatchesCurrentUser(r));
  }

  const blob = `${item.text || ""} ${item.title || ""}`;
  if (/notify|notified/i.test(blob) && recipientMatchesCurrentUser(blob)) {
    return true;
  }

  return false;
}

function shouldIncludeRelationshipNotifyEvent(_ev, parsed) {
  return !!parsed;
}

function applyFeedKeywordFilter(items) {
  const raw = (state.feedKeywordFilter || "").trim();
  if (!raw) return items;
  // Support comma-separated keywords (AND match: all must be present). Backward compatible with single keyword.
  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return items;
  return items.filter((it) => {
    const blob = `${it.title || ""} ${it.text || ""} ${it.author || ""}`.toLowerCase();
    return tokens.every((tok) => blob.includes(tok));
  });
}

function newFeedPagination() {
  return {
    historyStartIndex: 0,
    mailPage: 1,
    historyExhausted: false,
    mailExhausted: false,
    historySeen: new Set(),
    rawItems: [],
    loadingMore: false,
  };
}

function feedCanLoadMore() {
  const p = state.feedPagination;
  if (!p) return false;
  if ((state.feedNotificationsCache || []).length >= FEED_MAX_EVENTS) return false;
  return !p.historyExhausted;
}

function updateFeedLoadMoreUi() {
  const list = $("#notification-feed");
  if (!list) return;
  list.querySelector(".feed-load-more")?.remove();
  const p = state.feedPagination;
  if (!p || !feedCanLoadMore()) return;
  const li = document.createElement("li");
  li.className = "feed-load-more";
  const atCap = (state.feedNotificationsCache || []).length >= FEED_MAX_EVENTS;
  li.textContent = p.loadingMore
    ? "Loading more…"
    : atCap
      ? `Showing the ${FEED_MAX_EVENTS} most recent notifications`
      : "Scroll for older notifications";
  list.appendChild(li);
}

function updateFeedLoadingUi() {
  const tile = document.querySelector('[data-tile-id="tile-feed"]');
  const busy = state.feedLoading || state.feedPagination?.loadingMore;
  const indicator = tile?.querySelector(".feed-loading-indicator");
  if (indicator) indicator.classList.toggle("hidden", !busy);
  const hint = tile?.querySelector(".feed-range-hint");
  if (hint) {
    hint.textContent = busy ? "Loading…" : `Last ${FEED_DAYS} days`;
  }
}

function renderFeedNotificationList() {
  const list = $("#notification-feed");
  if (!list) return;

  let items = applyFeedKeywordFilter(state.feedNotificationsCache || []);
  updatePanelTileCount("tile-feed", items.length);
  updateFeedLoadingUi();

  list.innerHTML = "";
  if (!items.length) {
    if (state.feedLoading) {
      list.innerHTML = '<li class="feed-loading">Loading notifications…</li>';
      return;
    }
    const hiddenNote = state.hiddenFeedEntries.size ? " Some are hidden." : "";
    const kwNote = state.feedKeywordFilter?.trim() ? " Try clearing the keyword filter." : "";
    list.innerHTML = `<li>No new CRM events in the last ${FEED_DAYS} days.${hiddenNote}${kwNote}</li>`;
    return;
  }

  for (const it of items) {
    list.appendChild(renderFeedNotificationItem(it));
  }
  updateFeedLoadMoreUi();
}

function bindFeedInfiniteScroll() {
  const list = $("#notification-feed");
  if (!list || list.dataset.infiniteBound) return;
  list.dataset.infiniteBound = "1";
  list.addEventListener(
    "scroll",
    () => {
      if (list.scrollTop + list.clientHeight < list.scrollHeight - 72) return;
      loadMoreNotificationFeed().catch((err) => showToast(err.message, true));
    },
    { passive: true }
  );
}

function tryAddRelationshipNotifyEvent(items, seen, ev, periodFrom) {
  const parsed = parseRelationshipNotifyEvent(ev);
  if (!parsed) return;
  if (!shouldIncludeRelationshipNotifyEvent(ev, parsed)) return;
  if (!isWithinFeedWindow(parsed.date)) return;
  if (parsed.date) {
    const t = new Date(parsed.date).getTime();
    if (!Number.isNaN(t) && t < periodFrom) return;
  }
  const dedupe = `${parsed.id}-${parsed.text}-${parsed.author}-${parsed.date || ""}`;
  if (seen.has(dedupe)) return;
  seen.add(dedupe);
  items.push(parsed);
}

async function fetchFeedHistoryBatch(periodFrom, pagination) {
  const items = [];
  if (!pagination || pagination.historyExhausted) return items;

  const params = new URLSearchParams({
    startIndex: String(pagination.historyStartIndex),
    count: String(FEED_HISTORY_PAGE_SIZE),
    entityType: "opportunity",
  });

  let rows = [];
  try {
    rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${params}`));
  } catch {
    pagination.historyExhausted = true;
    return items;
  }

  if (!rows.length && pagination.historyStartIndex === 0) {
    try {
      const fallback = new URLSearchParams({
        startIndex: "0",
        count: String(FEED_HISTORY_PAGE_SIZE),
      });
      rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${fallback}`));
    } catch {
      pagination.historyExhausted = true;
      return items;
    }
  }

  for (const ev of rows) {
    tryAddRelationshipNotifyEvent(items, pagination.historySeen, ev, periodFrom);
  }

  pagination.historyStartIndex += rows.length;
  if (rows.length < FEED_HISTORY_PAGE_SIZE) pagination.historyExhausted = true;
  return items;
}

async function loadCrmRelationshipNotifyEventsBulk(periodFrom, pagination) {
  const items = [];
  let maxRows = 0;

  const primary = new URLSearchParams({
    startIndex: "0",
    count: String(FEED_MAX_EVENTS),
    entityType: "opportunity",
  });
  try {
    const rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${primary}`));
    maxRows = rows.length;
    for (const ev of rows) {
      tryAddRelationshipNotifyEvent(items, pagination.historySeen, ev, periodFrom);
    }
  } catch {
    /* history optional */
  }

  if (!maxRows) {
    try {
      const fallback = new URLSearchParams({ startIndex: "0", count: String(FEED_MAX_EVENTS) });
      const rows = unwrapHistoryEvents(await api(`/api/2.0/crm/history/filter?${fallback}`));
      maxRows = rows.length;
      for (const ev of rows) {
        tryAddRelationshipNotifyEvent(items, pagination.historySeen, ev, periodFrom);
      }
    } catch {
      /* try next query shape */
    }
  }

  pagination.historyStartIndex = Math.max(pagination.historyStartIndex, maxRows);
  pagination.historyExhausted = true;

  return items;
}

async function fetchFeedMailInitial(periodFrom, existingRaw = []) {
  const items = [];
  const seen = new Set();
  const myUserName = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  const queries = [];
  const mailPageSize = Math.min(FEED_MAIL_PAGE_SIZE, FEED_MAX_EVENTS);

  for (const search of FEED_MAIL_SEARCHES) {
    queries.push(
      new URLSearchParams({
        search,
        page_size: String(mailPageSize),
        sortorder: "descending",
        page: "1",
        period_from: new Date(periodFrom).toISOString(),
      }),
      new URLSearchParams({
        search,
        page_size: String(mailPageSize),
        sortorder: "descending",
        page: "1",
      })
    );
  }

  const atFeedCap = () => buildFeedNotificationList([...existingRaw, ...items]).length >= FEED_MAX_EVENTS;

  for (const q of queries) {
    if (atFeedCap()) break;
    try {
      const rows = unwrap(await api(`/api/2.0/mail/messages?${q}`));
      for (const mail of rows) {
        if (atFeedCap()) break;
        const parsed = parseMailNotifyMessage(mail);
        if (!parsed) continue;
        if (!isWithinFeedWindow(parsed.date)) continue;
        const fromAddr = String(
          (typeof mail.from === "string" ? mail.from : mail.from?.email || mail.from?.Email) || ""
        ).toLowerCase();
        if (myUserName && fromAddr && fromAddr === myUserName) continue;
        const dedupe = `${parsed.id}-${parsed.text}-${parsed.author}-${parsed.date || ""}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        items.push(parsed);
      }
    } catch {
      /* try next query */
    }
  }

  return items;
}

async function fetchFeedMailBatch(periodFrom, pagination) {
  const items = [];
  if (!pagination || pagination.mailExhausted) return items;

  const myUserName = (state.currentUser?.userName || state.currentUser?.UserName || "").toLowerCase();
  const q = new URLSearchParams({
    search: FEED_MAIL_SEARCH,
    page_size: String(FEED_MAIL_PAGE_SIZE),
    sortorder: "descending",
    page: String(pagination.mailPage),
    period_from: new Date(periodFrom).toISOString(),
  });

  let rows = [];
  try {
    rows = unwrap(await api(`/api/2.0/mail/messages?${q}`));
  } catch {
    pagination.mailExhausted = true;
    return items;
  }

  for (const mail of rows) {
    const parsed = parseMailNotifyMessage(mail);
    if (!parsed) continue;
    if (!isWithinFeedWindow(parsed.date)) continue;
    const fromAddr = String(
      (typeof mail.from === "string" ? mail.from : mail.from?.email || mail.from?.Email) || ""
    ).toLowerCase();
    if (myUserName && fromAddr && fromAddr === myUserName) continue;
    items.push(parsed);
  }

  pagination.mailPage += 1;
  if (rows.length < FEED_MAIL_PAGE_SIZE) pagination.mailExhausted = true;
  return items;
}

function commitFeedRawItems(rawItems) {
  state.feedRawItems = rawItems;
  let unique = buildFeedNotificationList(rawItems);
  const atCap = unique.length >= FEED_MAX_EVENTS;
  if (atCap) unique = unique.slice(0, FEED_MAX_EVENTS);
  if (atCap && state.feedPagination) {
    state.feedPagination.historyExhausted = true;
    state.feedPagination.mailExhausted = true;
  }
  applyFeedNotificationCache(unique);
}

async function loadMoreNotificationFeed() {
  const p = state.feedPagination;
  if (!p || p.loadingMore || !feedCanLoadMore()) return;
  if ((state.feedNotificationsCache || []).length >= FEED_MAX_EVENTS) return;
  p.loadingMore = true;
  updateFeedLoadingUi();
  updateFeedLoadMoreUi();

  const periodFrom = feedWindowStart();
  try {
    let batch = [];
    if (!p.historyExhausted) {
      batch = await fetchFeedHistoryBatch(periodFrom, p);
    }
    if (batch.length) {
      p.rawItems.push(...batch);
      commitFeedRawItems(p.rawItems);
    } else if (!feedCanLoadMore()) {
      updateFeedLoadMoreUi();
    }
  } finally {
    p.loadingMore = false;
    updateFeedLoadingUi();
    updateFeedLoadMoreUi();
  }
}

function isFeedCacheFresh() {
  return (
    state.feedFetchedAt != null &&
    Date.now() - state.feedFetchedAt < FEED_CACHE_TTL_MS &&
    state.feedNotificationsCache.length > 0 &&
    state.feedPagination != null
  );
}

function buildFeedNotificationList(rawItems) {
  const mergedByEvent = new Map();
  for (const it of rawItems) {
    const mergeKey = `${it.id}-${(it.text || "").slice(0, 60)}-${it.author}`;
    const prev = mergedByEvent.get(mergeKey);
    if (!prev || (prev.source === "history" && it.source === "mail")) {
      mergedByEvent.set(mergeKey, it);
    }
  }

  const seen = new Set();
  const unique = [];
  for (const it of mergedByEvent.values()) {
    const key = feedNotificationKey(it);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isFeedKeyHidden(key)) {
      const entry = state.hiddenFeedEntries.get(key);
      if (entry) {
        entry.snapshot = {
          id: it.id,
          title: it.title,
          text: it.text,
          author: it.author,
          date: it.date,
        };
      }
      continue;
    }
    unique.push({ ...it, key });
  }

  unique.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return unique;
}

function applyFeedNotificationCache(unique) {
  state.feedNotificationsCache = unique;
  state.feedFetchedAt = Date.now();
  const hiddenCountBefore = state.hiddenFeedEntries.size;
  pruneHiddenFeedEntries();
  if (state.hiddenFeedEntries.size < hiddenCountBefore) saveHiddenFeedEntries();
  else updateFeedHiddenToolbarButton();
  renderFeedNotificationList();
}

function decodeHtmlEntities(text) {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

const NOTIFY_TEMPLATE_MARKERS = [
  /subscription settings/i,
  /registered user of the/i,
  /manage your/i,
  /VirtualRootPath/i,
  /\$\{__VirtualRootPath\}/i,
  /\$EntityTitle/i,
  /\$__AuthorName/i,
  /\$AdditionalData/i,
  /\^You receive this email/i,
  /^h1\.\s/i,
  /has added a new event to\s+"[^"]+":/i,
  /New event added to\s+"[^"]+":/i,
];

function isNotifyTemplateSpam(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.length > 600) return true;
  return NOTIFY_TEMPLATE_MARKERS.some((re) => re.test(t));
}

/** Plain text for feed tiles — strips HTML, wiki/markdown mail templates, and CRM boilerplate. */
function toPlainDisplayText(raw, maxLen = 220) {
  if (raw == null) return "";
  let s = String(raw);
  if (!s.trim()) return "";

  if (/<[a-z][\s\S]*>/i.test(s)) {
    s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
    s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/p>/gi, "\n");
    s = s.replace(/<\/div>/gi, "\n");
    s = s.replace(/<[^>]+>/g, " ");
  }

  s = decodeHtmlEntities(s);
  s = s.replace(/\r/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/"([^"]+)":/g, "$1 ");
  s = s.replace(/\^([^^]+)\^/g, "$1");
  s = s.replace(/^h[1-6]\.\s*/gim, "");
  s = s.replace(/\${[^}]+}/g, " ");
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/Products\/CRM\/\S+/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Skip raw JSON/mail metadata dumps like {from "Name" ,to "email", ...}
  if (/^\{\s*(from|to|subject|cc|bcc|chain_id)\s+"/i.test(s)) return "";

  const added = s.match(/has added a new event[^:]*:\s*(.+)$/i);
  if (added) {
    const inner = added[1].replace(/\s+/g, " ").trim();
    if (inner && !isNotifyTemplateSpam(inner)) return inner.slice(0, maxLen);
  }

  const crmLine = s.match(/CRM\.\s*New event added to\s+(.+?)(?:\s{2,}|$)/i);
  if (crmLine) {
    const title = crmLine[1].trim();
    if (title && !isNotifyTemplateSpam(title)) return title.slice(0, maxLen);
  }

  return s.slice(0, maxLen);
}

function parseFeedDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function unwrapTalkMessages(data) {
  const raw = data?.response ?? data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.messages)) return raw.messages;
  if (Array.isArray(raw?.Messages)) return raw.Messages;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function normalizeTalkMessage(msg) {
  let text =
    msg?.text ||
    msg?.Text ||
    msg?.t ||
    msg?.message ||
    msg?.Message ||
    msg?.body ||
    msg?.Body ||
    msg?.content ||
    msg?.Content ||
    "";
  if (typeof text !== "string") text = String(text || "");
  text = toPlainDisplayText(text.replace(/<br\s*\/?>/gi, "\n"));

  const userName =
    msg?.userName ||
    msg?.UserName ||
    msg?.u ||
    msg?.from ||
    msg?.From ||
    msg?.author ||
    msg?.Author ||
    "";

  const dateTime = parseFeedDate(
    msg?.dateTime ?? msg?.DateTime ?? msg?.d ?? msg?.date ?? msg?.Date ?? msg?.time ?? msg?.Time
  );

  return { userName, text, dateTime };
}

function displayNameForUserName(userName) {
  if (!userName) return "Another user";
  const key = String(userName).toLowerCase();
  const found = state.portalUsers.find(
    (u) =>
      String(u.id).toLowerCase() === key ||
      String(u.displayName || "").toLowerCase() === key ||
      String(u.displayName || "")
        .toLowerCase()
        .includes(key)
  );
  if (found?.displayName) return found.displayName;
  return userName;
}

function opportunityIdFromText(text) {
  const t = String(text || "");
  const m =
    t.match(/Deals\.aspx\?id=(\d+)/i) ||
    t.match(/Deals\.aspx\?ID=(\d+)/i) ||
    t.match(/\/Products\/CRM\/Deals\.aspx\?id=(\d+)/i);
  return m ? Number(m[1]) : null;
}

function isCrmRelationshipNotifyText(text, meta = {}) {
  const t = String(text || "");
  const id = opportunityIdFromText(t);
  if (!id) return false;
  if (CRM_NOTIFY_MARKERS.some((re) => re.test(t))) return true;
  if (/^CRM\.\s*New event added to/i.test(meta.subject || "")) return true;
  if (meta.source === "talk") {
    if (CRM_NOTIFY_MARKERS.some((re) => re.test(t))) return true;
    if (/notify/i.test(t) && /Deals\.aspx\?id=/i.test(t)) return true;
    if (/added.*event/i.test(t) && /Deals\.aspx\?id=/i.test(t)) return true;
    const lines = t
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const hasUrl = lines.some((l) => /Deals\.aspx\?id=/i.test(l) || /\/Products\/CRM\/Deals/i.test(l));
    const hasBody = lines.some(
      (l) =>
        l.length > 2 &&
        !/Deals\.aspx|Products\/CRM|https?:\/\//i.test(l) &&
        !CRM_NOTIFY_MARKERS.some((re) => re.test(l))
    );
    return hasUrl && (hasBody || /CRM\./i.test(t));
  }
  return false;
}

function extractCrmNotifyFromText(text, meta = {}) {
  if (!isCrmRelationshipNotifyText(text, meta)) return null;
  const plain = String(text)
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "")
    .trim();
  const id = opportunityIdFromText(plain);
  if (!id) return null;

  let title =
    meta.title ||
    plain.match(/CRM\.\s*New event added to\s+(.+?)(?:\n|$)/i)?.[1]?.trim() ||
    plain.match(/New event added to\s+"([^"]+)"/i)?.[1]?.trim();
  title = (title || `Opportunity #${id}`).replace(/\s*\(.*\)\s*$/, "").trim();

  let eventText = toPlainDisplayText(plain);
  const lines = plain.split("\n").map((l) => toPlainDisplayText(l)).filter(Boolean);
  for (const line of lines) {
    if (/Deals\.aspx\?id=/i.test(line) || /\/Products\/CRM\/Deals/i.test(line)) continue;
    if (CRM_NOTIFY_MARKERS.some((re) => re.test(line))) continue;
    if (isNotifyTemplateSpam(line)) continue;
    if (line.length < 2) continue;
    eventText = line;
    break;
  }
  if (!eventText || isNotifyTemplateSpam(eventText)) {
    eventText = "New opportunity event";
  }

  return {
    id,
    title,
    author: meta.author || "Another user",
    authorId: meta.authorId || null,
    text: eventText.slice(0, 220),
    date: meta.date,
    source: meta.source || "notify",
  };
}

function parseTalkNotifyMessage(msg) {
  const norm = normalizeTalkMessage(msg);
  if (!norm.text?.trim()) return null;
  const author = displayNameForUserName(norm.userName);
  return extractCrmNotifyFromText(norm.text, {
    author,
    date: norm.dateTime,
    source: "talk",
  });
}

function parseMailNotifyMessage(mail) {
  const subject = mail.subject || mail.Subject || "";
  const body =
    mail.textBody ||
    mail.TextBody ||
    mail.plainText ||
    mail.PlainText ||
    mail.preview ||
    mail.Preview ||
    mail.introduction ||
    mail.Introduction ||
    "";
  const combined = `${subject}\n${body}`;
  const from = mail.from || mail.From || mail.fromEmail || mail.FromEmail;
  const author =
    (typeof from === "string" ? from : from?.displayName || from?.title || from?.email) || "Another user";
  const date =
    mail.dateSent?.value ??
    mail.dateSent ??
    mail.DateSent?.value ??
    mail.DateSent ??
    mail.receivedDate?.value ??
    mail.receivedDate;

  if (!/^CRM\.\s*New event added to/i.test(subject) && !isCrmRelationshipNotifyText(combined, { subject })) {
    return null;
  }

  let parsed = extractCrmNotifyFromText(combined, {
    author,
    title: subject.replace(/^CRM\.\s*New event added to\s+/i, "").trim(),
    date,
    source: "mail",
    subject,
  });

  if (!parsed && /^CRM\.\s*New event added to/i.test(subject)) {
    const id = opportunityIdFromText(body) || opportunityIdFromText(mail.htmlBody || mail.HtmlBody || "");
    if (id) {
      const eventText = toPlainDisplayText(body || subject);
      parsed = {
        id,
        title: subject.replace(/^CRM\.\s*New event added to\s+/i, "").trim() || `Opportunity #${id}`,
        author,
        text: eventText && !isNotifyTemplateSpam(eventText) ? eventText : "New opportunity event",
        date,
        source: "mail",
      };
    }
  }
  return parsed;
}

async function loadPortalUsers() {
  try {
    const params = new URLSearchParams({
      startIndex: "0",
      count: "300",
      employeeStatus: "Active",
    });
    const data = await api(`/api/2.0/people/filter?${params}`);
    state.portalUsers = unwrap(data)
      .map((u) => ({
        id: u.id ?? u.ID,
        displayName: u.displayName || u.DisplayName || u.userName || u.UserName || u.id,
      }))
      .filter((u) => u.id);
    state.portalUsers.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  } catch {
    state.portalUsers = [];
  }
}

function renderFeedNotificationItem(it) {
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.feedKey = it.key;
  if (it.date) {
    const d = new Date(it.date);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
      li.classList.add("feed-item-today");
    }
  }

  const row = document.createElement("div");
  row.className = "feed-item-row";

  const body = document.createElement("div");
  body.className = "feed-item-body";
  const a = document.createElement("a");
  a.href = crmOpportunityUrl(it.id);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = it.title;
  const meta = document.createElement("span");
  meta.className = "feed-meta";
  const when = it.date ? new Date(it.date).toLocaleString() : "";
  meta.textContent = `${it.author}${when ? " · " + when : ""} — ${it.text || ""}`;
  body.appendChild(a);
  body.appendChild(meta);

  const hideBtn = document.createElement("button");
  hideBtn.type = "button";
  hideBtn.className = "feed-hide-btn";
  hideBtn.title = "Hide this notification (stays hidden after refresh)";
  hideBtn.setAttribute("aria-label", "Hide notification");
  hideBtn.textContent = "Hide";
  hideBtn.addEventListener("click", () => {
    hideFeedNotification(it);
    state.feedNotificationsCache = state.feedNotificationsCache.filter((n) => n.key !== it.key);
    li.classList.add("feed-item-hiding");
    setTimeout(() => {
      li.remove();
      renderFeedNotificationList();
    }, 200);
  });

  row.appendChild(body);
  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "card-preview-btn";
  previewBtn.title = "Preview deal";
  previewBtn.setAttribute("aria-label", "Preview deal");
  previewBtn.innerHTML = CARD_ICON_PREVIEW_SCREEN;
  previewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openOpportunityPreviewModal(it.id, it.title);
  });
  row.appendChild(previewBtn);
  row.appendChild(hideBtn);
  li.appendChild(row);
  return li;
}

async function loadNotificationFeed({ force = false } = {}) {
  renderFeedTile();
  if (tileBodyCollapsed("tile-feed")) {
    showTileCollapsedHint("tile-feed", "Minimized — expand to load notifications");
    return;
  }
  const list = $("#notification-feed");
  if (!list) return;

  if (!state.hiddenFeedEntries.size) {
    state.hiddenFeedEntries = loadHiddenFeedEntriesFromStorage();
    pruneHiddenFeedEntries();
  }

  if (!force && isFeedCacheFresh() && state.feedRawItems.length) {
    renderFeedNotificationList();
    return;
  }

  state.feedLoading = true;
  updateFeedLoadingUi();
  list.innerHTML = '<li class="feed-loading">Loading notifications…</li>';
  updatePanelTileCount("tile-feed", 0);

  const periodFrom = feedWindowStart();
  const pagination = newFeedPagination();
  state.feedPagination = pagination;

  try {
    const historyItems = await loadCrmRelationshipNotifyEventsBulk(periodFrom, pagination);
    pagination.rawItems.push(...historyItems);

    if (!tileBodyCollapsed("tile-feed")) commitFeedRawItems(pagination.rawItems);
  } catch {
    if (!tileBodyCollapsed("tile-feed")) commitFeedRawItems(pagination.rawItems);
  } finally {
    state.feedLoading = false;
    updateFeedLoadingUi();
  }
}

function hideFeedNotification(it) {
  if (!it?.key) return;
  const prev = state.hiddenFeedEntries.get(it.key);
  state.hiddenFeedEntries.set(it.key, {
    hiddenAt: new Date().toISOString(),
    snapshot: {
      id: it.id,
      title: it.title,
      text: it.text,
      author: it.author,
      date: it.date,
    },
  });
  saveHiddenFeedEntries();
}

function unhideFeedNotification(key) {
  if (!key) return;
  state.hiddenFeedEntries.delete(key);
  saveHiddenFeedEntries();
}

const FEED_HIDDEN_ICON_HTML = `<svg class="tile-toolbar-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;

function updateFeedHiddenToolbarButton() {
  const btn = document.querySelector(".btn-feed-hidden-toggle");
  if (!btn) return;
  pruneHiddenFeedEntries();
}

function ensureFeedHiddenToolbarButton(tileEl) {
  if (!tileEl || tileEl.dataset.tileId !== "tile-feed") return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar || toolbar.querySelector(".btn-feed-hidden-toggle")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tile-btn tile-btn-icon btn-feed-hidden-toggle";
  btn.title = "Show hidden notifications";
  btn.setAttribute("aria-label", "Show hidden notifications");
  btn.innerHTML = FEED_HIDDEN_ICON_HTML;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openFeedHiddenModal();
  });

  const refreshBtn = toolbar.querySelector(".btn-tile-refresh");
  if (refreshBtn) toolbar.insertBefore(btn, refreshBtn);
  else {
    const layoutBtns = toolbar.querySelector(".tile-layout-btns");
    if (layoutBtns) toolbar.insertBefore(btn, layoutBtns);
    else toolbar.appendChild(btn);
  }
  updateFeedHiddenToolbarButton();
}

function openFeedHiddenModal() {
  const modal = $("#feed-hidden-modal");
  if (!modal) return;
  renderFeedHiddenModalList();
  modal.classList.remove("hidden");
}

function closeFeedHiddenModal() {
  $("#feed-hidden-modal")?.classList.add("hidden");
}

function renderFeedHiddenModalList() {
  const list = $("#feed-hidden-list");
  if (!list) return;
  pruneHiddenFeedEntries();
  const entries = [...state.hiddenFeedEntries.entries()].sort((a, b) => {
    const ta = new Date(a[1].hiddenAt).getTime();
    const tb = new Date(b[1].hiddenAt).getTime();
    return tb - ta;
  });

  list.innerHTML = "";
  if (!entries.length) {
    list.innerHTML = `<li class="feed-hidden-empty">No hidden notifications. Hidden items are kept for ${HIDDEN_FEED_RETENTION_DAYS} days.</li>`;
    return;
  }

  for (const [key, entry] of entries) {
    const snap = entry.snapshot || {};
    const li = document.createElement("li");
    li.className = "feed-hidden-item";

    const body = document.createElement("div");
    body.className = "feed-item-body";
    if (snap.id != null) {
      const a = document.createElement("a");
      a.href = crmOpportunityUrl(snap.id);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = snap.title || `Opportunity #${snap.id}`;
      body.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.textContent = snap.title || "Notification";
      body.appendChild(span);
    }
    const meta = document.createElement("span");
    meta.className = "feed-meta";
    const when = snap.date ? new Date(snap.date).toLocaleString() : "";
    const hiddenWhen = entry.hiddenAt ? new Date(entry.hiddenAt).toLocaleDateString() : "";
    meta.textContent = `${snap.author || ""}${when ? " · " + when : ""}${snap.text ? " — " + snap.text : ""}${hiddenWhen ? ` · Hidden ${hiddenWhen}` : ""}`;
    body.appendChild(meta);

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "feed-restore-btn";
    restoreBtn.textContent = "Show";
    restoreBtn.title = "Show this notification in the feed again";
    restoreBtn.addEventListener("click", async () => {
      unhideFeedNotification(key);
      li.remove();
      if (!state.hiddenFeedEntries.size) {
        list.innerHTML = `<li class="feed-hidden-empty">No hidden notifications. Hidden items are kept for ${HIDDEN_FEED_RETENTION_DAYS} days.</li>`;
      }
      renderFeedNotificationList();
    });

    li.appendChild(body);
    li.appendChild(restoreBtn);
    list.appendChild(li);
  }
}

function bindFeedHiddenModal() {
  const modal = $("#feed-hidden-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#feed-hidden-close")?.addEventListener("click", closeFeedHiddenModal);
  modal.querySelectorAll("[data-feed-hidden-dismiss]").forEach((el) => {
    el.addEventListener("click", closeFeedHiddenModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeFeedHiddenModal();
  });
}

const TILE_REFRESH_ICON_HTML = `<svg class="tile-refresh-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>`;

let lastDashboardActivityAt = Date.now();
let panelTileAutoRefreshTimer = null;

function noteDashboardActivity() {
  lastDashboardActivityAt = Date.now();
  const data = state.presenceData;
  if (!data || !data.me) return;
  const currentStatus = data.me.status || "";
  const currentAutoStatus = data.me.autoStatus || "";
  // Reset afk guard when status is no longer AFK (manual clear or server update)
  if (!currentStatus.startsWith("AFK")) {
    state._afkClearSent = false;
  }
  // Auto-expire AFK statuses when user becomes active; also clear idle auto-status
  // Never clear a manually-set DND status — only clear autoStatus in that case
  if (currentStatus.startsWith("AFK")) {
    // Debounce: only send once while status is AFK — avoids racing with
    // updateInferredStatus on repeated mousedown/scroll events
    if (state._afkClearSent) return;
    state._afkClearSent = true;
    state._suppressAutoStatus = false;
    // Send { status: "Online" } WITHOUT autoStatus — server preserves whatever
    // autoStatus was set by updateInferredStatus, preventing a race where the
    // AFK-clear request arrives after the auto-status request and wipes it out.
    presenceFetch("/api/presence/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Online" }),
    }).then(() => {
      state._afkClearSent = false;
      state.presenceData = null;
      if (state.hasPresenceTile) {
        fetchPresenceSnapshot().then(s => {
          state.presenceData = s;
          renderPresenceTileCompact(s);
          updatePresenceTileBadge();
        }).catch(() => {});
      }
    }).catch(() => { state._afkClearSent = false; });
  } else if (currentAutoStatus === "Idle") {
    // Only clear autoStatus; new server handles this, old server rejects but doesn't have this scenario
    presenceFetch("/api/presence/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoStatus: "" }),
    }).then(() => {
      state.presenceData = null;
      if (state.hasPresenceTile) {
        fetchPresenceSnapshot().then(s => {
          state.presenceData = s;
          renderPresenceTileCompact(s);
          updatePresenceTileBadge();
        }).catch(() => {});
      }
    }).catch(() => {});
  }
}

function isDashboardActivityFresh() {
  return Date.now() - lastDashboardActivityAt < DASHBOARD_IDLE_STOP_MS;
}

function isDashboardAppVisible() {
  const app = $("#app");
  return app && !app.classList.contains("hidden");
}

async function refreshAutoRefreshTilesQuietly() {
  if (!isDashboardAppVisible() || !isDashboardActivityFresh()) return;
  await loadExpandedDashboardTiles({ quiet: true });
}

function stopPanelTileAutoRefresh() {
  if (panelTileAutoRefreshTimer != null) {
    clearInterval(panelTileAutoRefreshTimer);
    panelTileAutoRefreshTimer = null;
  }
}

function startPanelTileAutoRefresh() {
  stopPanelTileAutoRefresh();
  panelTileAutoRefreshTimer = setInterval(() => {
    refreshAutoRefreshTilesQuietly().catch((err) => showToast(err.message, true));
  }, PANEL_TILE_AUTO_REFRESH_MS);
}

function bindDashboardActivityTracking() {
  if (bindDashboardActivityTracking._bound) return;
  bindDashboardActivityTracking._bound = true;
  const mark = () => noteDashboardActivity();
  const opts = { capture: true, passive: true };
  document.addEventListener("mousedown", mark, opts);
  document.addEventListener("keydown", mark, opts);
  document.addEventListener("touchstart", mark, opts);
  document.addEventListener("scroll", mark, opts);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) noteDashboardActivity();
  });
}

function ensureTileAutoRefreshButton(tileEl, tileId) {
  if (!isAutoRefreshTileId(tileId)) return;
  if (tileId === "tile-presence") return; // presence updates in real-time via heartbeat/poll
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar, :scope > .group-tile-bar");
  if (!toolbar || toolbar.querySelector(".btn-tile-refresh")) return;

  let label = "Refresh tile";
  if (tileId === "tile-feed") label = "Refresh notifications";
  else if (tileId === "tile-tasks") label = "Refresh tasks";
  else if (tileId.startsWith("calendar-")) label = "Refresh calendar";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tile-btn tile-btn-icon btn-tile-refresh";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = TILE_REFRESH_ICON_HTML;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (btn.disabled) return;
    noteDashboardActivity();
    btn.disabled = true;
    btn.classList.add("is-refreshing");
    try {
      await loadTileCrmData(tileId, { force: true });
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-refreshing");
    }
  });

  const countBadge = toolbar.querySelector(".tile-toolbar-count");
  if (countBadge?.nextSibling) toolbar.insertBefore(btn, countBadge.nextSibling);
  else toolbar.appendChild(btn);
}

function ensureTasksNewTaskButton(tileEl) {
  if (!tileEl || tileEl.dataset.tileId !== "tile-tasks") return;
  const toolbar = tileEl.querySelector(":scope > .tile-toolbar");
  if (!toolbar) return;

  // Ensure archive/list button (file cabinet icon) to the left of new task
  let archiveBtn = toolbar.querySelector("#tasks-list-btn");
  if (!archiveBtn) {
    archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.id = "tasks-list-btn";
    archiveBtn.className = "btn btn-ghost btn-tasks-list";
    archiveBtn.title = "View all tasks (open + completed)";
    // minimalistic file cabinet (one of the examples)
    // Minimalistic file cabinet icon (chosen; see 3 examples below in comments)
    archiveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><rect x="6" y="5" width="3" height="2" rx="0.5"/><rect x="15" y="5" width="3" height="2" rx="0.5"/><rect x="6" y="11" width="3" height="2" rx="0.5"/><rect x="15" y="11" width="3" height="2" rx="0.5"/></svg>`;
    // 3 example minimalistic file cabinet icons (stroke-based):
    // 1. (chosen) Rect with 3 horizontal dividers + small drawer handles: above svg
    // 2. Simple 2-drawer: <svg ...><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="16" x2="22" y2="16"/><rect x="4" y="3" width="4" height="2"/><rect x="16" y="3" width="4" height="2"/></svg>
    // 3. With verticals: <svg ...><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="12" y1="2" x2="12" y2="22"/><circle cx="7" cy="5" r="0.8"/><circle cx="17" cy="5" r="0.8"/></svg>
    const layoutBtns = toolbar.querySelector(".tile-layout-btns");
    if (layoutBtns) toolbar.insertBefore(archiveBtn, layoutBtns);
    else toolbar.appendChild(archiveBtn);
    archiveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTasksListModal().catch((err) => showToast(err.message, true));
    });
  }

  if (toolbar.querySelector(".btn-new-task")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary btn-new-task";
  btn.textContent = "New task";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openNewTaskModal().catch((err) => showToast(err.message, true));
  });
  const layoutBtns = toolbar.querySelector(".tile-layout-btns");
  if (layoutBtns) toolbar.insertBefore(btn, layoutBtns);
  else toolbar.appendChild(btn);
}

function setDealEditError(message) {
  const el = $("#deal-edit-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeDealEditModal() {
  restoreSideBySideCards();
  const modal = $("#deal-edit-modal");
  if (modal) modal.classList.add("hidden");
  state.dealEdit = null;
  setDealEditError("");
  const ne = $("#deal-edit-note-body");
  if (ne) ne.innerHTML = "";
  const sel = $("#deal-edit-selected-attachments");
  if (sel) sel.innerHTML = "";
  const inp = $("#deal-edit-note-attachments");
  if (inp) inp.value = "";
}

function tagIdForTitle(title, catalog = buildTagCatalog()) {
  const key = normalizeTagTitle(title).toLowerCase();
  return catalog.byTitleLower.get(key)?.id ?? null;
}

function renderOpportunityTagChips(mode) {
  const isQuickNote = mode === "quickNote";
  const edit = isQuickNote ? state.quickNote : state.dealEdit;
  const wrap = $(isQuickNote ? "#quick-note-tags" : "#deal-edit-tags");
  const addSel = $(isQuickNote ? "#quick-note-tag-add" : "#deal-edit-tag-add");
  if (!wrap || !edit) return;

  wrap.innerHTML = "";
  const catalog = buildTagCatalog();
  const current = new Set(edit.tags.map((t) => normalizeTagTitle(t)).filter(Boolean));

  for (const title of [...current].sort((a, b) => a.localeCompare(b))) {
    const chip = document.createElement("span");
    chip.className = "deal-edit-tag";
    chip.dataset.tagTitle = title;
    chip.appendChild(document.createTextNode(title));
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "deal-edit-tag-remove";
    rm.setAttribute("aria-label", `Remove tag ${title}`);
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      edit.tags = edit.tags.filter((t) => !tagsEqual(t, title, catalog));
      renderOpportunityTagChips(mode);
    });
    chip.appendChild(rm);
    wrap.appendChild(chip);
  }

  if (addSel) {
    const prev = addSel.value;
    addSel.innerHTML = '<option value="">Add tag…</option>';
    for (const tag of state.allTags) {
      const title = normalizeTagTitle(tag.title ?? tag);
      if (!title || current.has(title)) continue;
      const opt = document.createElement("option");
      opt.value = title;
      opt.textContent = title;
      addSel.appendChild(opt);
    }
    addSel.value = prev && [...addSel.options].some((o) => o.value === prev) ? prev : "";
  }
}

function renderDealEditTagChips() {
  renderOpportunityTagChips("dealEdit");
}

function renderQuickNoteTagChips() {
  renderOpportunityTagChips("quickNote");
}

function populateDealEditStageSelect(opp) {
  const sel = $("#deal-edit-stage");
  if (!sel) return;
  const current = String(resolveOppStageId(opp));
  sel.innerHTML = "";
  for (const stage of state.stages) {
    const opt = document.createElement("option");
    opt.value = String(stage.id ?? stage.ID ?? "");
    opt.textContent = stage.title || stage.Title || opt.value;
    if (String(opt.value) === current) opt.selected = true;
    sel.appendChild(opt);
  }
}

function populateNotifyUserSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    selectEl.appendChild(opt);
  }
}

function populateDealEditNotifySelect() {
  populateNotifyUserSelect($("#deal-edit-notify"));
}

function populateQuickNoteNotifySelect() {
  populateNotifyUserSelect($("#quick-note-notify"));
}

async function loadDealEditTags(opp, force = false) {
  let tags = getOppTagsFromRecord(opp);
  const id = opp.id ?? opp.ID;
  if (!tags.length && id != null) {
    try {
      const path = `/api/2.0/crm/opportunity/tag/${id}`;
      tags = unwrapEntityTags(await api(force ? bustCache(path) : path));
      opp.tags = tags;
    } catch {
      /* no tags */
    }
  }
  return tags;
}

async function openDealEditModal(opp, group) {
  const modal = $("#deal-edit-modal");
  const form = $("#deal-edit-form");
  if (!modal || !form) return;

  const id = opp.id ?? opp.ID;
  if (id == null) throw new Error("Opportunity id missing");

  setDealEditError("");
  form.reset();

  if (!state.stages.length) await loadStages();
  if (!state.allTags.length) await loadAllTags();
  if (!state.portalUsers.length) await loadPortalUsers();
  await loadHistoryCategories();
  populateDealEditNoteCategorySelect();

  const tags = await loadDealEditTags(opp);
  await loadOpportunityCustomFieldDefs();
  let dealEditCustomFieldValues = [];
  try {
    dealEditCustomFieldValues = await fetchOpportunityCustomFieldValues(id);
  } catch { /* non-fatal */ }
  state.dealEdit = {
    oppId: Number(id),
    group,
    oppTitle: opp.title || opp.Title || `Opportunity #${id}`,
    initialTags: [...tags],
    tags: [...tags],
    initialStageId: String(resolveOppStageId(opp)),
    initialDue: dueDateToInputValue(opportunityDueDateRaw(opp)),
    selectedAttachments: [],
    customFieldValues: dealEditCustomFieldValues,
  };

  // Toggle user fields button
  const toggleBtn = $("#deal-edit-toggle-fields");
  const ufWrap = $("#deal-edit-user-fields");
  if (toggleBtn && ufWrap) {
    if (toggleBtn._listener) toggleBtn.removeEventListener("click", toggleBtn._listener);
    ufWrap.classList.add("hidden");
    delete ufWrap.dataset.rendered;
    toggleBtn.textContent = "Show User Fields";
    const handler = () => {
      const hidden = ufWrap.classList.toggle("hidden");
      toggleBtn.textContent = hidden ? "Show User Fields" : "Hide User Fields";
      if (!hidden && !ufWrap.dataset.rendered) {
        renderDealEditUserFields(opp, state.dealEdit.customFieldValues);
        ufWrap.dataset.rendered = "1";
      }
    };
    toggleBtn._listener = handler;
    toggleBtn.addEventListener("click", handler);
  }

  const titleEl = $("#deal-edit-modal-title");
  if (titleEl) titleEl.textContent = state.dealEdit.oppTitle;

  const crmLink = $("#deal-edit-crm-link");
  if (crmLink) crmLink.href = crmOpportunityUrl(id);

  const dueInput = $("#deal-edit-due");
  if (dueInput) dueInput.value = state.dealEdit.initialDue;

  populateDealEditStageSelect(opp);
  populateDealEditNotifySelect();
  renderDealEditTagChips();

  modal.classList.remove("hidden");
  $("#deal-edit-due")?.focus();

  attachNoteAttachmentsListeners();
  // Clear any stale selected UI on open (ctx was just (re)created)
  renderSelectedAttachments("dealEdit");

  // When launched from opp preview (edit note / edit deal), position the editor popup LEFT (desktop) or TOP (mobile) of the preview modal.
  // Both remain interactive (see layout fn for pe:none trick + mobile stacking).
  // Also supports search-popup preview tabs.
  setTimeout(() => {
    const p = $("#opp-preview-modal");
    const s = $("#search-popup-modal");
    const isPreviewOpen = p && !p.classList.contains("hidden");
    const isSearchOpen = s && !s.classList.contains("hidden");
    if (state.dealEdit && oppPreviewContext && Number(oppPreviewContext.oppId) === Number(state.dealEdit.oppId)) {
      if (isPreviewOpen) {
        layoutSideBySideDealEditAndPreview();
      } else if (isSearchOpen) {
        layoutSideBySideDealEditAndSearchPopup();
      }
    }
    // Bookmark sidebar edit: position edit modal left of the sidebar so user sees both preview + edit form
    const bmSidebar = $("#bookmark-sidebar");
    if (state.dealEdit && bmSidebar && !bmSidebar.classList.contains("sidebar-hidden") && state.activeBookmarkTab && Number(state.activeBookmarkTab) === Number(state.dealEdit.oppId)) {
      layoutSideBySideDealEditAndBookmark();
    }
  }, 80);
}

function layoutSideBySideDealEditAndBookmark() {
  const sidebar = $("#bookmark-sidebar");
  const editModal = $("#deal-edit-modal");
  if (!sidebar || sidebar.classList.contains("sidebar-hidden") || !editModal || editModal.classList.contains("hidden")) return;
  const editCard = editModal.querySelector(".modal-card");
  if (!editCard) return;

  if (editCard.dataset.origStyle == null) editCard.dataset.origStyle = editCard.getAttribute("style") || "";

  const isMobile = window.innerWidth < 700;
  const gap = 12;

  if (isMobile) {
    const w = Math.min(720, window.innerWidth - 24);
    editCard.style.cssText = `position:fixed!important; left:12px!important; top:20px!important; width:${w}px!important; max-height:45vh!important; overflow:auto!important; z-index:2100!important; margin:0!important; pointer-events:auto!important;`;
  } else {
    const sbRect = sidebar.getBoundingClientRect();
    const editW = Math.min(520, Math.floor(window.innerWidth * 0.4));
    const left = Math.max(12, sbRect.left - editW - gap);
    const top = 36;
    editCard.style.cssText = `position:fixed!important; left:${left}px!important; top:${top}px!important; width:${editW}px!important; max-height:92vh!important; overflow:auto!important; z-index:2100!important; margin:0!important; pointer-events:auto!important; box-shadow:var(--shadow);`;
  }

  const back = editModal.querySelector(".modal-backdrop");
  if (back) {
    back.style.display = "none";
    back.dataset.sideHidden = "1";
  }
  editModal.style.pointerEvents = "none";
  editModal.style.zIndex = "2010";

  // Hook resize for re-layout
  if (!window._bookmarkEditResizeHooked) {
    window._bookmarkEditResizeHooked = true;
    window.addEventListener("resize", () => {
      const s = $("#bookmark-sidebar");
      const d = $("#deal-edit-modal");
      if (s && !s.classList.contains("sidebar-hidden") && d && !d.classList.contains("hidden") && state.activeBookmarkTab) {
        layoutSideBySideDealEditAndBookmark();
      }
    }, { passive: true });
  }
}

/* Upload a single file for note attachment using the native CRM handler.
   Returns {id, title} on success. Throws on failure (25MB check + network/CRM error).
   Uses state.currentUserId (from loadCurrentUser). */
async function uploadAttachmentForNote(file) {
  if (!file) throw new Error("No file");
  if (file.size > 25 * 1024 * 1024) {
    throw new Error(`File too large: ${file.name} (max 25 MB)`);
  }
  if (!state.currentUserId) {
    // Ensure we have it (safe to call; it is idempotent-ish)
    try { await loadCurrentUser(); } catch {}
  }
  const userId = state.currentUserId || "";
  const submit = "ASC.Web.CRM.Classes.FileUploaderHandler, ASC.Web.CRM";
  const url = `/api/proxy/Products/CRM/UploadProgress.ashx?submit=${encodeURIComponent(submit)}&UserID=${encodeURIComponent(userId)}`;

  const fd = new FormData();
  fd.append("file", file);

  const uploadHeaders = {};
  if (state.portalUrl) uploadHeaders["X-OnlyOffice-Portal"] = state.portalUrl;

  const res = await fetch(url, {
    method: "POST",
    body: fd,
    credentials: "same-origin",
    headers: uploadHeaders,
  });
  if (!res.ok) throw new Error(`Upload failed for ${file.name} (${res.status})`);
  const text = await res.text();
  // The handler returns a small object literal in text (from native capture)
  let data = {};
  try {
    const m = text.match(/\{[\s\S]*?\}/);
    if (m) data = Function('"use strict";return (' + m[0] + ")")();
  } catch {}
  if (!data || !data.Success || data.Data == null) {
    throw new Error(data && data.Message ? data.Message : `Upload failed for ${file.name}`);
  }
  return {
    id: data.Data,
    title: data.FileName || file.name,
  };
}

async function createOpportunityHistoryEvent(oppId, { content, categoryId, notifyUserList, fileIds = [], attachmentNames = [], failedAttachmentNames = [] }) {
  const html = noteContentToHtml(content);
  if (!html) throw new Error("Note text is required");

  let apiCall, descriptorBody, descriptorHeaders;

  const shortPreview = (content || "").replace(/<[^>]+>/g, " ").trim().slice(0, 80) || "(note)";

  if (fileIds && fileIds.length > 0) {
    // Use exact native form-urlencoded shape for attachments (from capture)
    // Use .json suffix for the history endpoint when sending attachments (matches native capture)
    const historyPath = "/api/2.0/crm/history.json";
    const params = new URLSearchParams();
    params.set("content", html);
    params.set("categoryId", String(categoryId || 0));
    params.set("entityId", String(oppId));
    params.set("entityType", "opportunity");
    params.set("created", new Date().toISOString());
    if (notifyUserList?.length) {
      // notifyUserList is not in the minimal capture but keep support if server accepts
      params.set("notifyUserList", JSON.stringify(notifyUserList));
    }
    fileIds.forEach((fid) => params.append("fileId[]", String(fid)));

    descriptorBody = params.toString();
    descriptorHeaders = { "Content-Type": "application/x-www-form-urlencoded" };

    apiCall = () => api(historyPath, {
      method: "POST",
      headers: descriptorHeaders,
      body: descriptorBody,
      showCrashBanner: false,
    });
  } else {
    const body = {
      entityType: "opportunity",
      entityId: oppId,
      contactId: 0,
      content: html,
      categoryId,
    };
    if (notifyUserList?.length) body.notifyUserList = notifyUserList;

    descriptorBody = JSON.stringify(body);
    descriptorHeaders = { "Content-Type": "application/json" };

    apiCall = () => api("/api/2.0/crm/history", {
      method: "POST",
      headers: descriptorHeaders,
      body: descriptorBody,
      showCrashBanner: false,
    });
  }

  const historyDescriptorPath = (fileIds && fileIds.length > 0) ? "/api/2.0/crm/history.json" : "/api/2.0/crm/history";

  const res = await withCrmQueueOnTransient(apiCall, {
    method: "POST",
    path: historyDescriptorPath,
    body: descriptorBody,
    headers: descriptorHeaders,
    description: `Add note to opportunity ${oppId}`,
    opType: "history",
    targetId: String(oppId),
    // Extra for the right-side note queue list (pending + completed rendering)
    notePreview: shortPreview,
    attachmentNames: attachmentNames || [],
    failedAttachmentNames: failedAttachmentNames || [],
  });
  if (res && res.queued) {
    // Note was queued (CRM temporarily down) — caller should show "queued" instead of "sent"
    return { queued: true };
  }

  // Immediate success (no queue needed): record for the attachments status list (10s auto-clear)
  addCompletedNoteQueueEntry({
    preview: shortPreview,
    attachmentNames: attachmentNames || [],
    failedNames: failedAttachmentNames || [],
    status: "success",
  });
  return { success: true };
}

function renderSelectedAttachments(ctxKey) {
  const isQuick = ctxKey === "quickNote";
  const ctx = isQuick ? state.quickNote : state.dealEdit;
  const container = $(isQuick ? "#quick-note-selected-attachments" : "#deal-edit-selected-attachments");
  if (!container) return;
  container.innerHTML = "";
  if (!ctx || !Array.isArray(ctx.selectedAttachments) || ctx.selectedAttachments.length === 0) return;
  ctx.selectedAttachments.forEach((file, idx) => {
    const span = document.createElement("span");
    span.className = "sel-item";
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    span.innerHTML = `${escapeHtml(file.name)} (${sizeMB} MB) <span class="sel-remove" data-idx="${idx}">×</span>`;
    const rem = span.querySelector(".sel-remove");
    if (rem) {
      rem.addEventListener("click", (e) => {
        e.preventDefault();
        if (ctx.selectedAttachments) ctx.selectedAttachments.splice(idx, 1);
        renderSelectedAttachments(ctxKey);
      });
    }
    container.appendChild(span);
  });
}

function attachNoteAttachmentsListeners() {
  // Deal-edit
  const dealInp = $("#deal-edit-note-attachments");
  if (dealInp && !dealInp._attachmentsBound) {
    dealInp._attachmentsBound = true;
    dealInp.addEventListener("change", () => {
      const ctx = state.dealEdit;
      if (!ctx) return;
      if (!Array.isArray(ctx.selectedAttachments)) ctx.selectedAttachments = [];
      const files = Array.from(dealInp.files || []);
      files.forEach((f) => {
        if (f.size > 25 * 1024 * 1024) {
          showToast(`Skipped ${f.name}: exceeds 25 MB`, true);
          return;
        }
        ctx.selectedAttachments.push(f);
      });
      dealInp.value = ""; // reset so same file can be picked again
      renderSelectedAttachments("dealEdit");
    });
  }

  // Quick-note
  const qInp = $("#quick-note-note-attachments");
  if (qInp && !qInp._attachmentsBound) {
    qInp._attachmentsBound = true;
    qInp.addEventListener("change", () => {
      const ctx = state.quickNote;
      if (!ctx) return;
      if (!Array.isArray(ctx.selectedAttachments)) ctx.selectedAttachments = [];
      const files = Array.from(qInp.files || []);
      files.forEach((f) => {
        if (f.size > 25 * 1024 * 1024) {
          showToast(`Skipped ${f.name}: exceeds 25 MB`, true);
          return;
        }
        ctx.selectedAttachments.push(f);
      });
      qInp.value = "";
      renderSelectedAttachments("quickNote");
    });
  }
}

function plainTextToNoteHtml(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br/>");
}

function noteContentToHtml(input) {
  let s = String(input || "").trim();
  if (!s) return "";
  // If it contains tags, assume rich HTML from the note editor (controlled formatting)
  if (/<[a-z]/i.test(s)) {
    // Light sanitization: drop scripts and inline event handlers
    s = s
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\s+on\w+="[^"]*"/gi, "")
      .replace(/\s+on\w+='[^']*'/gi, "");
    // Treat "empty" editor artifacts as no content
    if (!s || /^(<br\s*\/?>|\s*|<div>\s*<br\s*\/?>\s*<\/div>)$/i.test(s)) return "";
    return s;
  }
  return plainTextToNoteHtml(s);
}



async function applyDealTagChanges(oppId, initialTags, nextTags) {
  if (!dealTagsChanged(initialTags, nextTags)) return;

  const catalog = buildTagCatalog();
  const initialSet = new Set(initialTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));
  const nextSet = new Set(nextTags.map((t) => tagLookupKey(t, catalog)).filter(Boolean));

  const toAdd = nextTags.filter((t) => {
    const key = tagLookupKey(t, catalog);
    return key && !initialSet.has(key);
  });
  const toRemove = initialTags.filter((t) => {
    const key = tagLookupKey(t, catalog);
    return key && !nextSet.has(key);
  });

  for (const title of toAdd) {
    await addOpportunityTag(oppId, title);
  }

  for (const title of toRemove) {
    await removeOpportunityTag(oppId, title);
  }
}

async function submitDealEditForm(e) {
  e.preventDefault();
  setDealEditError("");
  const ctx = state.dealEdit;
  if (!ctx) return;

  const submitBtn = $("#deal-edit-submit");
  if (submitBtn) submitBtn.disabled = true;

  // Small tooltip-like note below the button on press.
  const submittingNote = showSubmittingNote(submitBtn);

  // Show progress immediately on button press
  setConnectionState('connected');
  showCRMSyncStatus('Connecting...');

  const connectStart = Date.now();

  const closeTimer = setTimeout(() => {
    closeDealEditModal();
  }, 2500);

  try {
    const oppId = ctx.oppId;
    const dueVal = $("#deal-edit-due")?.value ?? "";
    const stageId = $("#deal-edit-stage")?.value ?? "";
    const noteEl = $("#deal-edit-note-body");
    const noteBody = noteEl
      ? (noteEl.tagName === "TEXTAREA" ? (noteEl.value || "").trim() : (noteEl.innerHTML || "").trim())
      : "";
    const notifySel = $("#deal-edit-notify");
    const notifyUserList = notifySel
      ? [...notifySel.selectedOptions].map((o) => o.value).filter(Boolean)
      : [];
    const dueChanged = dueVal !== ctx.initialDue;
    const stageChanged = stageId && stageId !== ctx.initialStageId;

    if (dueChanged) {
      try {
        await updateOpportunityDueDate(oppId, dueVal);
      } catch (err) {
        throw dealEditStepError("Due date", err);
      }
    }

    if (stageChanged) {
      try {
        await updateOpportunityStage(oppId, stageId);
      } catch (err) {
        throw dealEditStepError("Stage", err);
      }
    }

    const tagsChanged = dealTagsChanged(ctx.initialTags, ctx.tags);
    if (tagsChanged) {
      try {
        await applyDealTagChanges(oppId, ctx.initialTags, ctx.tags);
        state.oppTagCache?.invalidate(oppId);
      } catch (err) {
        throw dealEditStepError("Tags", err);
      }
    }

    if (noteBody) {
      try {
        const categoryId = resolveHistoryCategoryId($("#deal-edit-note-category")?.value);

        // Attachments: upload first (text priority — note is always sent)
        if (!state.currentUserId) {
          try { await loadCurrentUser(); } catch {}
        }
        const files = Array.isArray(ctx.selectedAttachments) ? ctx.selectedAttachments : [];
        const successfulIds = [];
        const successfulNames = [];
        const failedNames = [];
        for (const f of files) {
          try {
            const up = await uploadAttachmentForNote(f);
            successfulIds.push(up.id);
            successfulNames.push(up.title || f.name);
          } catch (e) {
            failedNames.push(f.name);
            showToast(`Failed to upload ${f.name}: ${e && e.message ? e.message : e}`, true);
          }
        }

        const noteResult = await createOpportunityHistoryEvent(oppId, {
          content: noteBody,
          categoryId,
          notifyUserList,
          fileIds: successfulIds,
          attachmentNames: successfulNames,
          failedAttachmentNames: failedNames,
        });
        if (noteResult && noteResult.queued) {
          showToast("Note queued for retry (CRM is temporarily down). Check the header indicator.");
        }
      } catch (err) {
        throw dealEditStepError("Event note", err);
      }
    }

    // Custom user fields
    const dealEditFieldValues = collectDealEditCustomFieldValues();
    if (dealEditFieldValues.length) {
      try {
        await updateOpportunityCustomFieldsViaPut(oppId, dealEditFieldValues);
        state.oppCustomFieldCache?.invalidate(oppId);
      } catch (err) {
        showToast("User fields not saved: " + (err.message || err).slice(0, 100), true);
      }
    }

    const group = ctx.group;
    clearTimeout(closeTimer);
    hideCRMSyncStatus();  // clear any "Connecting..." immediately on successful response
    closeDealEditModal();
    // Once the CRM server has successfully received the push, go straight to success.
    // No lingering "Connected & Syncing..." after the event.
    onCRMSuccess();
    showCRMSyncStatus('Deal edit sent successfully');
    setTimeout(() => {
      hideCRMSyncStatus();
    }, 1500);
    showToast("Deal updated");
    updateInferredStatus("edit", ctx.oppTitle || "");
    // Targeted single-opp refresh instead of full group refetch (~200ms vs 5-10s).
    // Fetches just the one changed opportunity and updates its card DOM in-place.
    // For stage/tag changes that affect board layout, re-renders the board from in-memory data (no CRM filter call).
    setTimeout(async () => {
      if (!group) { refreshAll(); return; }
      try {
        const updatedOpp = await fetchOpportunityForUpdate(oppId);
        if (!updatedOpp) { refreshGroup(group); return; }
        // Ensure tags are present so card styling (amber border) applies correctly.
        await enrichOpportunitiesTags([updatedOpp]);
        indexOpportunity(updatedOpp);
        const oppIdx = group.opportunities.findIndex(o => Number(o.id ?? o.ID) === oppId);
        if (oppIdx >= 0) group.opportunities[oppIdx] = updatedOpp;
        else group.opportunities.push(updatedOpp);
        if (stageChanged || tagsChanged) {
          const boardEl = groupDomEl(group)?.querySelector('.board');
          if (boardEl) renderGroupBoard(group, boardEl);
        } else {
          updateOpportunityCardDom(updatedOpp, group);
        }
      } catch (e) {
        refreshGroup(group);
      }
    }, 40);

    // Preview persistence: if the preview modal is still open for this same opp (we launched edit without closing it),
    // refresh its content so the user sees the just-saved changes without having to re-open.
    // Also deferred (was causing perceived hangs on prod after deal edits / notes).
    setTimeout(() => {
      const previewEl = $("#opp-preview-modal");
      const previewId = oppPreviewContext && oppPreviewContext.oppId;
      if (previewEl && !previewEl.classList.contains("hidden") && previewId != null && Number(previewId) === Number(ctx.oppId)) {
        openOpportunityPreviewModal(previewId, ctx.oppTitle || "", group || ctx.group).catch(() => {});
      }
    }, 30);
  } catch (err) {
    clearTimeout(closeTimer);
    const msg = err instanceof Error ? err.message : String(err);
    setDealEditError(msg || "Could not save deal");
    hideCRMSyncStatus();
  } finally {
    clearTimeout(closeTimer);
    if (submitBtn) submitBtn.disabled = false;
    if (submittingNote && submittingNote.parentNode) submittingNote.parentNode.removeChild(submittingNote);
  }
}

function bindDealEditModal() {
  const modal = $("#deal-edit-modal");
  const form = $("#deal-edit-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitDealEditForm(e).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setDealEditError(msg || "Could not save deal");
    });
  });

  $("#deal-edit-cancel")?.addEventListener("click", closeDealEditModal);
  modal.querySelectorAll("[data-deal-edit-dismiss]").forEach((el) => {
    el.addEventListener("click", closeDealEditModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeDealEditModal();
  });

  $("#deal-edit-tag-add")?.addEventListener("change", (e) => {
    const title = e.target.value;
    if (!title || !state.dealEdit) return;
    if (!state.dealEdit.tags.some((t) => tagsEqual(t, title))) {
      state.dealEdit.tags.push(title);
      renderDealEditTagChips();
    }
    e.target.value = "";
  });
}

function setQuickNoteError(message) {
  const el = $("#quick-note-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeQuickNoteModal() {
  restoreSideBySideCards();
  const modal = $("#quick-note-modal");
  if (modal) modal.classList.add("hidden");
  state.quickNote = null;
  setQuickNoteError("");
  const ne = $("#quick-note-note-body");
  if (ne) ne.innerHTML = "";
  const sel = $("#quick-note-selected-attachments");
  if (sel) sel.innerHTML = "";
  const inp = $("#quick-note-note-attachments");
  if (inp) inp.value = "";
}

function clearQuickNoteOpportunitySelection() {
  state.quickNote = null;
  const search = $("#quick-note-opportunity-search");
  const selected = $("#quick-note-opportunity-selected");
  const crmLink = $("#quick-note-crm-link");
  if (search) search.value = "";
  if (selected) selected.textContent = "";
  if (crmLink) {
    crmLink.classList.add("hidden");
    crmLink.href = "#";
  }
  const due = $("#quick-note-due");
  if (due) due.value = "";
  const tags = $("#quick-note-tags");
  if (tags) tags.innerHTML = "";
}

function updateQuickNoteOpportunitySelectedUi() {
  const ctx = state.quickNote;
  const selected = $("#quick-note-opportunity-selected");
  const search = $("#quick-note-opportunity-search");
  const crmLink = $("#quick-note-crm-link");
  if (!selected) return;
  if (ctx?.oppId) {
    selected.innerHTML = `${escapeHtml(ctx.oppTitle || `Opportunity #${ctx.oppId}`)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
    $(".contact-clear", selected)?.addEventListener("click", () => {
      clearQuickNoteOpportunitySelection();
      renderQuickNoteTagChips();
    });
    if (crmLink) {
      crmLink.href = crmOpportunityUrl(ctx.oppId);
      crmLink.classList.remove("hidden");
    }
    if (search) search.value = "";
  } else {
    selected.textContent = "";
    if (crmLink) crmLink.classList.add("hidden");
  }
}

async function applyQuickNoteOpportunity(oppSummary) {
  const id = Number(oppSummary.id ?? oppSummary.ID);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid opportunity");

  const opp = await fetchOpportunityForUpdate(id);
  if (!opp) throw new Error("Could not load opportunity");

  if (!state.allTags.length) await loadAllTags();
  const tags = await loadDealEditTags(opp);
  const oppId = Number(opp.id ?? opp.ID ?? id);

  state.quickNote = {
    oppId,
    oppTitle: opp.title || opp.Title || oppSummary.title || `Opportunity #${oppId}`,
    initialTags: [...tags],
    tags: [...tags],
    initialDue: dueDateToInputValue(opportunityDueDateRaw(opp)),
    group: state.groups.find((g) => (g.opportunities || []).some((o) => Number(o.id ?? o.ID) === oppId)) || null,
    selectedAttachments: [],
  };

  const dueInput = $("#quick-note-due");
  if (dueInput) dueInput.value = state.quickNote.initialDue;

  updateQuickNoteOpportunitySelectedUi();
  renderQuickNoteTagChips();
  renderSelectedAttachments("quickNote");
  $("#quick-note-note-body")?.focus();
}

async function openQuickNoteModal() {
  const modal = $("#quick-note-modal");
  const form = $("#quick-note-form");
  if (!modal || !form) return;

  setQuickNoteError("");
  form.reset();
  clearQuickNoteOpportunitySelection();
  state.quickNote = null;
  // Always clear the contenteditable note body (form.reset does not affect divs)
  const noteBodyEl = $("#quick-note-note-body");
  if (noteBodyEl) noteBodyEl.innerHTML = "";

  await loadHistoryCategories();
  populateQuickNoteCategorySelect();
  if (!state.allTags.length) await loadAllTags();
  if (!state.portalUsers.length) await loadPortalUsers();
  populateQuickNoteNotifySelect();

  const results = $("#quick-note-opportunity-results");
  if (results) results.classList.add("hidden");

  modal.classList.remove("hidden");

  attachNoteAttachmentsListeners();
  renderSelectedAttachments("quickNote");

  // If opp preview is open, snap this quick note modal side-by-side (left on desktop, top on mobile) with the preview.
  setTimeout(() => {
    const p = $("#opp-preview-modal");
    if (p && !p.classList.contains("hidden") && oppPreviewContext && oppPreviewContext.oppId != null) {
      layoutSideBySideDealEditAndPreview();  // generalized to support quick-note as side
    }
  }, 80);

  $("#quick-note-opportunity-search")?.focus();
}

async function submitQuickNoteForm(e) {
  e.preventDefault();
  setQuickNoteError("");
  const ctx = state.quickNote;
  if (!ctx?.oppId) {
    setQuickNoteError("Select an opportunity for this note.");
    return;
  }

  const noteEl = $("#quick-note-note-body");
  const noteText = noteEl ? (noteEl.innerText || noteEl.textContent || "").trim() : "";
  if (!noteText) {
    setQuickNoteError("Event note is required.");
    return;
  }
  const noteBody = noteEl ? (noteEl.innerHTML || "").trim() : "";

  const submitBtn = $("#quick-note-submit");
  if (submitBtn) submitBtn.disabled = true;

  // Small tooltip-like note below the button on press.
  const submittingNote = showSubmittingNote(submitBtn);

  // Show progress immediately on button press
  setConnectionState('connected');
  showCRMSyncStatus('Connecting...');

  const connectStart = Date.now();

  const closeTimer = setTimeout(() => {
    closeQuickNoteModal();
  }, 2500);

  try {
    const oppId = ctx.oppId;
    const dueVal = $("#quick-note-due")?.value ?? "";
    const notifySel = $("#quick-note-notify");
    const notifyUserList = notifySel
      ? [...notifySel.selectedOptions].map((o) => o.value).filter(Boolean)
      : [];
    const dueChanged = dueVal !== ctx.initialDue;
    const categoryId = resolveHistoryCategoryId($("#quick-note-note-category")?.value);

    if (dueChanged) {
      try {
        await updateOpportunityDueDate(oppId, dueVal);
      } catch (err) {
        throw dealEditStepError("Due date", err);
      }
    }

    const tagsChanged = dealTagsChanged(ctx.initialTags, ctx.tags);
    if (tagsChanged) {
      try {
        await applyDealTagChanges(oppId, ctx.initialTags, ctx.tags);
        state.oppTagCache?.invalidate(oppId);
      } catch (err) {
        throw dealEditStepError("Tags", err);
      }
    }

    try {
      if (!state.currentUserId) {
        try { await loadCurrentUser(); } catch {}
      }
      const files = Array.isArray(ctx.selectedAttachments) ? ctx.selectedAttachments : [];
      const successfulIds = [];
      const successfulNames = [];
      const failedNames = [];
      for (const f of files) {
        try {
          const up = await uploadAttachmentForNote(f);
          successfulIds.push(up.id);
          successfulNames.push(up.title || f.name);
        } catch (e) {
          failedNames.push(f.name);
          showToast(`Failed to upload ${f.name}: ${e && e.message ? e.message : e}`, true);
        }
      }

      const noteResult = await createOpportunityHistoryEvent(oppId, {
        content: noteBody,
        categoryId,
        notifyUserList,
        fileIds: successfulIds,
        attachmentNames: successfulNames,
        failedAttachmentNames: failedNames,
      });
      if (noteResult && noteResult.queued) {
        showToast("Note queued for retry (CRM is temporarily down). Check the header indicator.");
      }
    } catch (err) {
      throw dealEditStepError("Event note", err);
    }

    const group = ctx.group;
    clearTimeout(closeTimer);
    hideCRMSyncStatus();  // clear any "Connecting..." immediately on successful response
    closeQuickNoteModal();
    // Once the CRM server has successfully received the push, go straight to success.
    // No lingering "Connected & Syncing..." after the event.
    onCRMSuccess();
    showCRMSyncStatus('Note sent successfully');
    setTimeout(() => {
      hideCRMSyncStatus();
    }, 1500);
    showToast("Note saved");
    updateInferredStatus("note", ctx.oppTitle || "");

    // Defer all post-submit refreshes to keep the UI responsive (prevents the "hangs, nothing clickable, then full re-render"
    // after quick notes and similar pushes). Quick notes only affect history (in preview) or due/tags (board).
    // Never do heavy refreshAll synchronously right after the note create.
    const needsBoardUpdate = dueChanged || tagsChanged;
    const previewEl = $("#opp-preview-modal");
    const isSidePreviewCase = previewEl && !previewEl.classList.contains("hidden") && ctx && ctx.oppId != null &&
      (oppPreviewContext && Number(oppPreviewContext.oppId) === Number(ctx.oppId));

    if (isSidePreviewCase) {
      // Targeted: just refresh the open preview so new note appears (and any due/tag changes reflected)
      setTimeout(() => {
        const titleHint = ctx.oppTitle || "";
        openOpportunityPreviewModal(ctx.oppId, titleHint, ctx.group || null).catch(() => {});
      }, 20);
    }
    if (needsBoardUpdate && !isSidePreviewCase) {
      // Targeted single-opp refresh instead of full group refetch.
      setTimeout(async () => {
        if (!group) { refreshAll(); return; }
        try {
          const updatedOpp = await fetchOpportunityForUpdate(oppId);
          if (!updatedOpp) { refreshGroup(group); return; }
          // Ensure tags are present so card styling (amber border) applies correctly.
          await enrichOpportunitiesTags([updatedOpp]);
          indexOpportunity(updatedOpp);
          const oppIdx = group.opportunities.findIndex(o => Number(o.id ?? o.ID) === oppId);
          if (oppIdx >= 0) group.opportunities[oppIdx] = updatedOpp;
          else group.opportunities.push(updatedOpp);
          if (tagsChanged) {
            const boardEl = groupDomEl(group)?.querySelector('.board');
            if (boardEl) renderGroupBoard(group, boardEl);
          } else {
            updateOpportunityCardDom(updatedOpp, group);
          }
        } catch (e) {
          refreshGroup(group);
        }
      }, 60);
    }
  } catch (err) {
    clearTimeout(closeTimer);
    const msg = err instanceof Error ? err.message : String(err);
    setQuickNoteError(msg || "Could not save note");
    hideCRMSyncStatus();
  } finally {
    clearTimeout(closeTimer);
    if (submitBtn) submitBtn.disabled = false;
    if (submittingNote && submittingNote.parentNode) submittingNote.parentNode.removeChild(submittingNote);
  }
}

function bindQuickNoteOpportunityPicker() {
  const input = $("#quick-note-opportunity-search");
  const results = $("#quick-note-opportunity-results");
  if (!input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";
  let debounce;

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 1) {
        results.classList.add("hidden");
        return;
      }
      try {
        const opps = await searchOpportunitiesByTitle(q);
        results.classList.remove("hidden");
        if (!opps.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const o of opps) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = o.title;
          btn.addEventListener("click", () => {
            results.classList.add("hidden");
            applyQuickNoteOpportunity(o).catch((err) => setQuickNoteError(err.message));
          });
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);
  });

  document.addEventListener("click", (e) => {
    const wrap = input.closest(".opportunity-picker-field");
    if (wrap && !wrap.contains(e.target)) results.classList.add("hidden");
  });
}

function bindQuickNoteModal() {
  const modal = $("#quick-note-modal");
  const form = $("#quick-note-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitQuickNoteForm(e).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setQuickNoteError(msg || "Could not save note");
    });
  });

  $("#quick-note-cancel")?.addEventListener("click", closeQuickNoteModal);
  modal.querySelectorAll("[data-quick-note-dismiss]").forEach((el) => {
    el.addEventListener("click", closeQuickNoteModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeQuickNoteModal();
  });

  $("#quick-note-tag-add")?.addEventListener("change", (e) => {
    const title = e.target.value;
    if (!title || !state.quickNote) return;
    if (!state.quickNote.tags.some((t) => tagsEqual(t, title))) {
      state.quickNote.tags.push(title);
      renderQuickNoteTagChips();
    }
    e.target.value = "";
  });

  bindQuickNoteOpportunityPicker();
}

function setCreateOpportunityError(message) {
  const el = $("#create-opportunity-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeCreateOpportunityModal() {
  const modal = $("#create-opportunity-modal");
  if (modal) modal.classList.add("hidden");
  setCreateOpportunityError("");
  state.newOpportunityDraft = null;
}

function resetNewOpportunityDraft() {
  state.newOpportunityDraft = {
    contactId: null,
    contactLabel: "",
    tags: [],
  };
}

function createOppCustomFieldInputKind(def) {
  const code = customFieldTypeCode(def);
  if (code === 1) return "textarea";
  if (code === 2) return "select";
  if (code === 3) return "checkbox";
  if (code === 4) return "heading";
  if (code === 5) return "date";
  return "text";
}

function parseCustomFieldSelectOptions(def) {
  if (customFieldTypeCode(def) !== 2) return [];
  const raw = def?.mask ?? def?.Mask ?? def?.valueList ?? def?.ValueList ?? def?.options ?? def?.Options;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o?.title ?? o?.Title ?? o?.value ?? o ?? "").trim()).filter(Boolean);
  }
  const str = String(raw).trim();
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed.map((o) => String(o ?? "").trim()).filter(Boolean);
  } catch {
    /* mask is not a JSON option list */
  }
  return [];
}

function parseCustomFieldTextMaxLength(def) {
  if (customFieldTypeCode(def) !== 0) return null;
  const raw = def?.mask ?? def?.Mask;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "object" ? raw : JSON.parse(String(raw));
    const size = Number(parsed?.size ?? parsed?.Size);
    return Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    return null;
  }
}

function buildCreateOppCustomFieldInput(def, fieldId) {
  const kind = createOppCustomFieldInputKind(def);
  const id = `create-opp-cf-${fieldId}`;

  if (kind === "checkbox") {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    return input;
  }

  if (kind === "select") {
    const input = document.createElement("select");
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "—";
    input.appendChild(empty);
    for (const optText of parseCustomFieldSelectOptions(def)) {
      const opt = document.createElement("option");
      opt.value = optText;
      opt.textContent = optText;
      input.appendChild(opt);
    }
    return input;
  }

  if (kind === "textarea") {
    const input = document.createElement("textarea");
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    input.rows = 3;
    try {
      const mask = JSON.parse(def.mask ?? def.Mask ?? "{}");
      if (mask.rows) input.rows = Number(mask.rows) || 3;
      if (mask.cols) input.style.width = "100%";
    } catch {
      /* default */
    }
    return input;
  }

  if (kind === "date") {
    const input = document.createElement("input");
    input.type = "date";
    input.id = id;
    input.dataset.customFieldId = String(fieldId);
    return input;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.dataset.customFieldId = String(fieldId);
  const maxLen = parseCustomFieldTextMaxLength(def);
  if (maxLen) input.maxLength = maxLen;
  return input;
}

function populateCreateOppStageSelect() {
  const sel = $("#create-opp-stage");
  if (!sel) return;
  sel.innerHTML = "";
  for (const stage of state.stages) {
    const opt = document.createElement("option");
    opt.value = String(stage.id ?? stage.ID ?? "");
    opt.textContent = stage.title || stage.Title || opt.value;
    sel.appendChild(opt);
  }
  if (sel.options.length) sel.selectedIndex = 0;
}

function populateCreateOppResponsibleSelect() {
  const sel = $("#create-opp-responsible");
  if (!sel) return;
  sel.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (state.currentUserId != null) sel.value = String(state.currentUserId);
}

function populateCreateOppAccessSelect() {
  const sel = $("#create-opp-access");
  if (!sel) return;
  sel.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (state.currentUserId != null) {
    for (const opt of sel.options) {
      if (opt.value === String(state.currentUserId)) opt.selected = true;
    }
  }
}

function populateCreateOppTagAddSelect() {
  const sel = $("#create-opp-tag-add");
  if (!sel || !state.newOpportunityDraft) return;
  const current = new Set(state.newOpportunityDraft.tags.map((t) => normalizeTagTitle(t)).filter(Boolean));
  sel.innerHTML = '<option value="">Add tag…</option>';
  for (const tag of state.allTags) {
    const title = normalizeTagTitle(tag.title ?? tag);
    if (!title || current.has(title)) continue;
    const opt = document.createElement("option");
    opt.value = title;
    opt.textContent = title;
    sel.appendChild(opt);
  }
}

function renderCreateOppTagChips() {
  const wrap = $("#create-opp-tags");
  const draft = state.newOpportunityDraft;
  if (!wrap || !draft) return;
  wrap.innerHTML = "";
  const catalog = buildTagCatalog();
  for (const title of draft.tags) {
    const chip = document.createElement("span");
    chip.className = "deal-edit-tag";
    chip.appendChild(document.createTextNode(normalizeTagTitle(title)));
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "deal-edit-tag-remove";
    rm.setAttribute("aria-label", `Remove tag ${title}`);
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      draft.tags = draft.tags.filter((t) => !tagsEqual(t, title, catalog));
      renderCreateOppTagChips();
      populateCreateOppTagAddSelect();
    });
    chip.appendChild(rm);
    wrap.appendChild(chip);
  }
  populateCreateOppTagAddSelect();
}

function updateCreateOppContactSelectedUi() {
  const draft = state.newOpportunityDraft;
  const selected = $("#create-opp-contact-selected");
  const search = $("#create-opp-contact-search");
  if (!draft || !selected) return;
  if (draft.contactId) {
    selected.innerHTML = `${escapeHtml(draft.contactLabel || `Contact #${draft.contactId}`)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
    $(".contact-clear", selected)?.addEventListener("click", () => {
      draft.contactId = null;
      draft.contactLabel = "";
      if (search) search.value = "";
      updateCreateOppContactSelectedUi();
    });
  } else {
    selected.textContent = "";
  }
}

function renderCreateOppCustomFields() {
  const wrap = $("#create-opp-custom-fields");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (!CREATE_OPP_USER_FIELDS_ENABLED) {
    const hint = document.createElement("p");
    hint.className = "field-hint create-opp-user-fields-unavailable";
    hint.title = "Custom user fields are not available yet";
    hint.textContent = "Custom user fields are not available yet.";
    wrap.appendChild(hint);
    return;
  }

  if (!state.customFieldDefs.length) {
    wrap.innerHTML =
      '<p class="field-hint">No user fields configured for opportunities in CRM (Settings → User Fields → Opportunities).</p>';
    return;
  }

  const legend = document.createElement("p");
  legend.className = "create-opp-legend";
  legend.textContent = "User fields";
  wrap.appendChild(legend);

  for (const def of state.customFieldDefs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (isCreateOppExcludedUserField(def)) continue;

    const label = customFieldLabel(def) || `Field ${fieldId}`;
    const kind = createOppCustomFieldInputKind(def);

    if (kind === "heading") {
      const head = document.createElement("p");
      head.className = "create-opp-field-heading";
      head.textContent = label;
      wrap.appendChild(head);
      continue;
    }

    const field = document.createElement("div");
    field.className = "field";
    field.dataset.customFieldId = String(fieldId);

    const input = buildCreateOppCustomFieldInput(def, fieldId);

    if (kind === "checkbox") {
      const lbl = document.createElement("label");
      lbl.className = "checkbox-filter";
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(` ${label}`));
      field.appendChild(lbl);
    } else {
      const lbl = document.createElement("label");
      lbl.setAttribute("for", input.id);
      lbl.textContent = label;
      field.appendChild(lbl);
      field.appendChild(input);
    }
    wrap.appendChild(field);
  }
}

function customFieldDefinitionId(def) {
  const id = def?.id ?? def?.ID ?? def?.fieldId ?? def?.FieldId;
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function formatCustomFieldValueForApi(def, rawValue) {
  const code = customFieldTypeCode(def);
  if (code === 3) {
    const t = String(rawValue ?? "").trim().toLowerCase();
    if (t === "false" || t === "0" || t === "no" || t === "off") return "false";
    return "true";
  }
  if (code === 5) {
    const raw = String(rawValue ?? "").trim();
    if (!raw) return "";
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const y = d.getFullYear();
    return `${m}/${day}/${y}`;
  }
  return String(rawValue ?? "").trim();
}

function collectCreateOppCustomFieldValues() {
  if (!CREATE_OPP_USER_FIELDS_ENABLED) return [];
  const values = [];
  const wrap = $("#create-opp-custom-fields");
  if (!wrap) return values;

  for (const def of state.customFieldDefs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    if (createOppCustomFieldInputKind(def) === "heading") continue;

    const fieldEl = wrap.querySelector(`[data-custom-field-id="${String(fieldId)}"]`);
    if (!fieldEl) continue;

    const input = fieldEl.querySelector("input, select, textarea");
    if (!input) continue;

    let raw;
    if (input.type === "checkbox") {
      if (!input.checked) continue;
      raw = "true";
    } else {
      raw = String(input.value ?? "").trim();
      if (!raw) continue;
    }
    values.push({ fieldId, value: formatCustomFieldValueForApi(def, raw), def });
  }
  return values;
}

/** OnlyOffice ItemKeyValuePair<int,string> on create/update opportunity bodies. */
function buildCustomFieldListForApi(fieldValues) {
  return fieldValues.map(({ fieldId, value }) => ({
    key: Number(fieldId),
    value: String(value ?? ""),
  }));
}

function extractOpportunityCustomFieldList(opp) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const fieldId = customFieldDefinitionId(item) ?? Number(item.id ?? item.ID ?? item.fieldId);
      if (!Number.isFinite(fieldId)) continue;
      const raw = item.value ?? item.Value ?? item.fieldValue ?? item.FieldValue;
      if (raw == null || raw === "") continue;
      const def = state.customFieldById.get(String(fieldId));
      out.push({ fieldId, value: formatCustomFieldValueForApi(def, raw), def });
    }
  }
  return out;
}

function mergeCustomFieldValues(existing, incoming) {
  const byId = new Map();
  for (const row of existing) {
    if (row?.fieldId != null) byId.set(Number(row.fieldId), row);
  }
  for (const row of incoming) {
    if (row?.fieldId != null) byId.set(Number(row.fieldId), row);
  }
  return [...byId.values()];
}

async function fetchOpportunityCustomFieldValues(oppId, force = false) {
  const paths = [
    `/api/2.0/crm/opportunity/${oppId}/customfield`,
    `/api/2.0/crm/opportunity/${oppId}/customfields`,
  ];
  for (const path of paths) {
    try {
      const list = unwrap(await api(force ? bustCache(path) : path));
      if (list.length) return list;
    } catch {
      /* try next */
    }
  }
  return [];
}

function readSavedCustomFieldValue(item) {
  const raw = item?.fieldValue ?? item?.FieldValue ?? item?.value ?? item?.Value;
  if (raw == null) return "";
  return String(raw).trim();
}

function customFieldValuesMatch(want, got) {
  const a = String(want ?? "").trim();
  const b = String(got ?? "").trim();
  if (!a && !b) return true;
  if (a === b) return true;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  if (a === "true" && (b === "True" || b === "1")) return true;
  if (a === "false" && (b === "False" || b === "0")) return true;
  return false;
}

async function setOpportunityCustomFieldValue(oppId, fieldId, fieldValue) {
  const val = String(fieldValue ?? "");
  const qs = new URLSearchParams({ fieldValue: val }).toString();
  const path = `/api/2.0/crm/opportunity/${oppId}/customfield/${fieldId}`;
  const attempts = [
    () => api(`${path}?${qs}`, { method: "POST" }),
    () =>
      api(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValue: val }),
      }),
    () =>
      api(path, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ fieldValue: val }).toString(),
      }),
  ];
  let lastErr;
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Could not set custom field");
}

async function updateOpportunityCustomFieldsViaPut(oppId, fieldValues) {
  const opp = await fetchOpportunityForUpdate(oppId);
  const existing = extractOpportunityCustomFieldList(opp);
  const merged = mergeCustomFieldValues(existing, fieldValues);
  const body = buildOpportunityPutBody(opp);
  body.customFieldList = buildCustomFieldListForApi(merged);
  await api(`/api/2.0/crm/opportunity/${oppId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function verifyOpportunityCustomFieldsSaved(oppId, fieldValues) {
  const saved = await fetchOpportunityCustomFieldValues(oppId);
  const missing = [];
  for (const { fieldId, value, def } of fieldValues) {
    const item = saved.find((row) => Number(row.id ?? row.ID) === Number(fieldId));
    const got = readSavedCustomFieldValue(item);
    if (!customFieldValuesMatch(value, got)) {
      const label = customFieldLabel(def) || `field #${fieldId}`;
      missing.push(label);
    }
  }
  if (missing.length) {
    throw new Error(`CRM did not store: ${missing.join(", ")}`);
  }
}

function renderDealEditUserFields(opp, customFieldValues) {
  const wrap = $("#deal-edit-user-fields");
  if (!wrap) return;
  wrap.innerHTML = "";

  const defs = state.customFieldDefs;
  if (!defs.length) {
    wrap.innerHTML = '<p class="field-hint">No user fields configured.</p>';
    return;
  }

  const valuesByFieldId = new Map();
  for (const item of customFieldValues) {
    const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
    if (fieldId != null) valuesByFieldId.set(String(fieldId), item);
  }

  for (const def of defs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (isCreateOppExcludedUserField(def)) continue;

    const label = customFieldLabel(def) || `Field ${fieldId}`;
    const kind = createOppCustomFieldInputKind(def);
    if (kind === "heading") continue;

    const savedItem = valuesByFieldId.get(String(fieldId));
    const savedRaw = savedItem ? readSavedCustomFieldValue(savedItem) : "";
    let currentValue = savedRaw;

    const field = document.createElement("div");
    field.className = "field";
    field.dataset.customFieldId = String(fieldId);

    const input = buildCreateOppCustomFieldInput(def, fieldId);
    const inputId = `deal-edit-cf-${fieldId}`;
    input.id = inputId;
    if (input.dataset) input.dataset.customFieldId = String(fieldId);

    if (kind === "checkbox") {
      if (currentValue === "true" || currentValue === "1" || currentValue.toLowerCase() === "yes") {
        input.checked = true;
      }
      const lbl = document.createElement("label");
      lbl.className = "checkbox-filter";
      lbl.appendChild(input);
      lbl.appendChild(document.createTextNode(` ${label}`));
      field.appendChild(lbl);
    } else {
      input.value = currentValue;
      const lbl = document.createElement("label");
      lbl.setAttribute("for", inputId);
      lbl.textContent = label;
      field.appendChild(lbl);
      field.appendChild(input);
    }
    wrap.appendChild(field);
  }
}

function collectDealEditCustomFieldValues() {
  const wrap = $("#deal-edit-user-fields");
  if (!wrap || wrap.classList.contains("hidden")) return [];

  const values = [];
  if (!state.customFieldDefs) return values;

  for (const def of state.customFieldDefs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (isCreateOppExcludedUserField(def)) continue;
    if (createOppCustomFieldInputKind(def) === "heading") continue;

    const fieldEl = wrap.querySelector(`[data-custom-field-id="${String(fieldId)}"]`);
    if (!fieldEl) continue;

    const input = fieldEl.querySelector("input, select, textarea");
    if (!input) continue;

    let raw;
    if (input.type === "checkbox") {
      if (!input.checked) continue;
      raw = "true";
    } else {
      raw = String(input.value ?? "").trim();
      if (!raw) continue;
    }
    values.push({ fieldId, value: formatCustomFieldValueForApi(def, raw), def });
  }
  return values;
}

async function applyCreateOpportunityCustomFields(oppId, fieldValues) {
  if (!fieldValues.length) return;

  const failures = [];
  for (const row of fieldValues) {
    try {
      await setOpportunityCustomFieldValue(oppId, row.fieldId, row.value);
    } catch (err) {
      failures.push({
        label: customFieldLabel(row.def) || `field #${row.fieldId}`,
        message: err?.message || String(err),
      });
    }
  }

  let verifyErr;
  try {
    await verifyOpportunityCustomFieldsSaved(oppId, fieldValues);
    return;
  } catch (err) {
    verifyErr = err;
  }

  try {
    await updateOpportunityCustomFieldsViaPut(oppId, fieldValues);
    await verifyOpportunityCustomFieldsSaved(oppId, fieldValues);
    return;
  } catch (putErr) {
    if (failures.length === fieldValues.length) {
      const detail = failures.map((f) => `${f.label}: ${f.message}`).join("; ");
      throw new Error(detail || putErr.message || "Could not save user fields");
    }
    throw new Error(
      `${verifyErr?.message || putErr.message || "User fields not saved"}. ` +
        `Failed fields: ${failures.map((f) => f.label).join(", ") || "unknown"}`
    );
  }
}

function syncCreateOppPrivateFields() {
  const isPrivate = !!$("#create-opp-private")?.checked;
  $("#create-opp-access-field")?.classList.toggle("hidden", !isPrivate);
}

function buildOpportunityCreateBody(form) {
  const title = form.title?.trim();
  if (!title) throw new Error("Title is required");

  const responsibleId = form.responsibleId?.trim();
  if (!responsibleId) throw new Error("Responsible user is required");

  const stageId = Number(form.stageId);
  if (!Number.isFinite(stageId) || stageId <= 0) throw new Error("Stage is required");

  const draft = state.newOpportunityDraft;
  const contactId = draft?.contactId != null ? Number(draft.contactId) : 0;
  const stage = state.stages.find((s) => Number(s.id ?? s.ID) === stageId);
  const successProbability = Number(stage?.successProbability ?? stage?.SuccessProbability ?? 0);

  const body = {
    contactid: Number.isFinite(contactId) ? contactId : 0,
    members: [],
    title,
    description: form.description?.trim() || "",
    responsibleid: String(responsibleId),
    bidType: 0,
    bidValue: 0,
    bidCurrencyAbbr: "USD",
    perPeriodValue: 1,
    stageid: stageId,
    successProbability: Number.isFinite(successProbability) ? successProbability : 0,
    actualCloseDate: null,
    expectedCloseDate: form.expectedCloseDate ? serializeCrmTimestamp(form.expectedCloseDate) : null,
    isPrivate: !!form.isPrivate,
    accessList: [],
    isNotify: !!form.isNotify,
  };

  if (form.isPrivate) {
    const accessSel = $("#create-opp-access");
    body.accessList = accessSel
      ? [...accessSel.selectedOptions].map((o) => o.value).filter(Boolean)
      : [];
    if (!body.accessList.length) body.accessList = [String(responsibleId)];
  } else {
    body.accessList = [];
  }

  if (form.customFields?.length) {
    body.customFieldList = buildCustomFieldListForApi(form.customFields);
  }

  return body;
}

async function createCrmOpportunity(body) {
  const res = await withCrmQueueOnTransient(
    () => api("/api/2.0/crm/opportunity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      showCrashBanner: false,
    }),
    {
      method: "POST",
      path: "/api/2.0/crm/opportunity",
      body: JSON.stringify(body),
      description: `Create opportunity "${body?.title || body?.Title || 'untitled'}"`,
      opType: "opp",
    }
  );
  if (res && res.queued) {
    return { queued: true };
  }
  return res;
}

function bindCreateOppContactPicker() {
  const input = $("#create-opp-contact-search");
  const results = $("#create-opp-contact-results");
  if (!input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";
  let debounce;

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 2) {
        results.classList.add("hidden");
        return;
      }
      try {
        const contacts = await searchContacts(q);
        results.classList.remove("hidden");
        if (!contacts.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const c of contacts) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = c.displayName || c.title || `Contact #${c.id}`;
          btn.addEventListener("click", () => {
            const draft = state.newOpportunityDraft;
            if (!draft) return;
            draft.contactId = Number(c.id ?? c.ID);
            draft.contactLabel = btn.textContent;
            input.value = "";
            results.classList.add("hidden");
            updateCreateOppContactSelectedUi();
          });
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 350);
  });

  document.addEventListener("click", (e) => {
    const wrap = $("#create-opp-contact-field");
    if (wrap && !wrap.contains(e.target)) results.classList.add("hidden");
  });
}

async function applyCreateOpportunityTags(oppId, tags) {
  for (const title of tags) {
    try {
      await addOpportunityTag(oppId, title);
    } catch (err) {
      showToast(`Opportunity created; tag failed: ${title}`, true);
    }
  }
}

async function submitCreateOpportunityForm(e) {
  e.preventDefault();
  setCreateOpportunityError("");
  const submitBtn = $("#create-opportunity-submit");
  if (submitBtn) submitBtn.disabled = true;

  // Small tooltip-like note below the button on press.
  const submittingNote = showSubmittingNote(submitBtn);

  // Show progress immediately on button press (bottom right, with bar).
  setConnectionState('connected');
  showCRMSyncStatus('Connecting...');

  // Cap popup visible time at 2.5s max. Safe to close sooner because data is saved locally first (optimistic + queue).
  const closeTimer = setTimeout(() => {
    closeCreateOpportunityModal();
  }, 2500);

  try {
    const customFields = collectCreateOppCustomFieldValues();
    const body = buildOpportunityCreateBody({
      title: $("#create-opp-title")?.value,
      description: $("#create-opp-description")?.value,
      responsibleId: $("#create-opp-responsible")?.value,
      stageId: $("#create-opp-stage")?.value,
      expectedCloseDate: $("#create-opp-expected-close")?.value,
      isPrivate: $("#create-opp-private")?.checked,
      isNotify: $("#create-opp-notify")?.checked,
      customFields,
    });

    const data = await createCrmOpportunity(body);
    if (data && data.queued) {
      clearTimeout(closeTimer);
      closeCreateOpportunityModal();
      await refreshAll().catch(() => {});
      return;
    }
    const created = unwrapCreatedEntity(data);
    const oppId = created?.id ?? created?.ID ?? data?.id ?? data?.ID;
    if (oppId == null) throw new Error("Opportunity created but no id returned");

    if (customFields.length) {
      // Small delay before per-field custom value POSTs (timing/CRM indexing hypothesis per ISSUE-001).
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        await applyCreateOpportunityCustomFields(oppId, customFields);
      } catch (cfErr) {
        showToast(`Opportunity created; user fields not saved: ${cfErr.message}`, true);
      }
    }

    const tags = state.newOpportunityDraft?.tags || [];
    if (tags.length) await applyCreateOpportunityTags(oppId, tags);

    clearTimeout(closeTimer);
    closeCreateOpportunityModal();
    hideCRMSyncStatus();
    onCRMSuccess();
    showCRMSyncStatus('Opportunity created successfully');
    setTimeout(() => {
      hideCRMSyncStatus();
    }, 1500);
    await refreshAll();
  } catch (err) {
    clearTimeout(closeTimer);
    setCreateOpportunityError(err.message || "Could not create opportunity");
    hideCRMSyncStatus();
  } finally {
    clearTimeout(closeTimer);
    if (submitBtn) submitBtn.disabled = false;
    if (submittingNote && submittingNote.parentNode) submittingNote.parentNode.removeChild(submittingNote);
  }
}

async function openCreateOpportunityModal() {
  const modal = $("#create-opportunity-modal");
  const form = $("#create-opportunity-form");
  if (!modal || !form) return;

  setCreateOpportunityError("");
  form.reset();
  resetNewOpportunityDraft();

  if (!state.stages.length) await loadStages();
  if (!state.allTags.length) await loadAllTags();
  if (!state.portalUsers.length) await loadPortalUsers();
  if (CREATE_OPP_USER_FIELDS_ENABLED) await loadOpportunityCustomFieldDefs(true);

  populateCreateOppStageSelect();
  populateCreateOppResponsibleSelect();
  populateCreateOppAccessSelect();
  renderCreateOppCustomFields();
  renderCreateOppTagChips();
  updateCreateOppContactSelectedUi();
  syncCreateOppPrivateFields();

  const notify = $("#create-opp-notify");
  if (notify) notify.checked = true;

  modal.classList.remove("hidden");
  $("#create-opp-title")?.focus();
}

function setAddTileError(message) {
  const el = $("#add-tile-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function showAddTileChooser() {
  $("#add-tile-options")?.classList.remove("hidden");
  $("#add-tile-calendar-form")?.classList.add("hidden");
  $("#add-tile-notes-form")?.classList.add("hidden");
  $("#add-tile-modal-actions")?.classList.remove("hidden");
  setAddTileError("");
}

function showAddTileCalendarForm() {
  $("#add-tile-options")?.classList.add("hidden");
  $("#add-tile-calendar-form")?.classList.remove("hidden");
  $("#add-tile-notes-form")?.classList.add("hidden");
  $("#add-tile-modal-actions")?.classList.add("hidden");
  const nameInput = $("#add-tile-calendar-name");
  const urlInput = $("#add-tile-calendar-url");
  if (nameInput && !nameInput.value) nameInput.value = "My calendar";
  if (urlInput) urlInput.value = "";
  setAddTileError("");
  urlInput?.focus();
}

function populateAddNotesPresetSelect() {
  const sel = $("#add-tile-notes-preset");
  if (!sel || sel.dataset.bound) return;
  sel.dataset.bound = "1";
  sel.innerHTML = "";
  for (const p of NOTES_ADD_PRESETS) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.label;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    const preset = NOTES_ADD_PRESETS.find((p) => p.id === sel.value);
    const nameInput = $("#add-tile-notes-name");
    if (preset && nameInput && (!nameInput.value.trim() || nameInput.value === "Notes")) {
      nameInput.value = preset.name;
    }
  });
}

function showAddTileNotesForm() {
  $("#add-tile-options")?.classList.add("hidden");
  $("#add-tile-calendar-form")?.classList.add("hidden");
  $("#add-tile-notes-form")?.classList.remove("hidden");
  $("#add-tile-modal-actions")?.classList.add("hidden");
  loadOpportunityCustomFieldDefs().catch(() => {});
  populateAddNotesPresetSelect();
  const presetSel = $("#add-tile-notes-preset");
  const nameInput = $("#add-tile-notes-name");
  const previewDefault = $("#add-tile-notes-preview-default");
  if (presetSel) presetSel.value = "blank";
  if (nameInput) nameInput.value = "Notes";
  if (previewDefault) previewDefault.checked = false;
  nameInput?.focus();
}

function addNotesTileFromForm() {
  const preset = NOTES_ADD_PRESETS.find((p) => p.id === $("#add-tile-notes-preset")?.value) || NOTES_ADD_PRESETS[0];
  const name = $("#add-tile-notes-name")?.value?.trim() || preset.name || "Notes";
  const openPreview = $("#add-tile-notes-preview-default")?.checked === true;
  const notes = newNotesTile({
    name,
    content: notesPresetContent(preset),
    viewMode: openPreview ? "preview" : "edit",
    defaultViewMode: openPreview ? "preview" : null,
    updatedAt: new Date().toISOString(),
  });
  state.notesTiles.push(notes);
  scheduleUserProfileSave();
  const tid = notesTileId(notes);
  if (!state.tileLayout.order.includes(tid)) {
    state.tileLayout.order.push(tid);
    saveLayoutToStorage();
  }
  closeAddTileModal();
  renderBoardGroups();
  showToast("Notes tile added");
}

function openAddTileModal() {
  const modal = $("#add-tile-modal");
  if (!modal) return;
  showAddTileChooser();
  modal.classList.remove("hidden");
}

function closeAddTileModal() {
  const modal = $("#add-tile-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  showAddTileChooser();
  setAddTileError("");
}

function addOpportunityGroupTile() {
  state.groups.push(newGroup({ name: `Group ${state.groups.length + 1}` }));
  saveGroupsToStorage();
  closeAddTileModal();
  renderBoardGroups();
  refreshGroup(state.groups[state.groups.length - 1]).catch((err) => showToast(err.message, true));
  showToast("Opportunity group added");
}

async function addCalendarTileFromForm() {
  const name = $("#add-tile-calendar-name")?.value?.trim() || "Calendar";
  const feedUrl = $("#add-tile-calendar-url")?.value?.trim() || "";
  if (!feedUrl) {
    setAddTileError("Calendar URL is required");
    return;
  }
  if (!/^https?:\/\//i.test(feedUrl)) {
    setAddTileError("URL must start with http:// or https://");
    return;
  }
  setAddTileError("");
  const cal = newCalendarTile({ name, feedUrl });
  state.calendarTiles.push(cal);
  saveCalendarsToStorage();
  const tid = calendarTileId(cal);
  if (!state.tileLayout.order.includes(tid)) {
    state.tileLayout.order.push(tid);
    saveLayoutToStorage();
  }
  closeAddTileModal();
  renderBoardGroups();
  showToast("Calendar tile added");
  try {
    await loadCalendarForTile(cal);
  } catch {
    /* toast from loader */
  }
}

function bindAddTileModal() {
  const modal = $("#add-tile-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  $("#add-tile-btn")?.addEventListener("click", openAddTileModal);
  $("#add-tile-cancel")?.addEventListener("click", closeAddTileModal);
  modal.querySelectorAll("[data-add-tile-dismiss]").forEach((el) => {
    el.addEventListener("click", closeAddTileModal);
  });
  $("#add-tile-opportunity-group")?.addEventListener("click", () => {
    addOpportunityGroupTile();
  });
  $("#add-tile-calendar")?.addEventListener("click", showAddTileCalendarForm);
  $("#add-tile-notes")?.addEventListener("click", showAddTileNotesForm);
  $("#add-tile-local-kanban")?.addEventListener("click", addLocalKanbanTile);
  $("#add-tile-calendar-back")?.addEventListener("click", showAddTileChooser);
  $("#add-tile-notes-back")?.addEventListener("click", showAddTileChooser);
  $("#add-tile-calendar-create")?.addEventListener("click", () => {
    addCalendarTileFromForm().catch((err) => setAddTileError(err.message));
  });
  $("#add-tile-notes-create")?.addEventListener("click", addNotesTileFromForm);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeAddTileModal();
  });
}

function addLocalKanbanTile() {
  // New function for local-only kanban (per user request): no CRM, custom statuses via columns, drag-drop cards, per-card desc + notes history.
  closeAddTileModal();
  const kanban = newLocalKanbanTile({ name: "Local Kanban" });
  if (!state.localKanbanTiles) state.localKanbanTiles = [];
  state.localKanbanTiles.push(kanban);
  saveLocalKanbanTilesToStorage();
  // ensure layout
  if (!state.tileLayout.order.includes(localKanbanTileId(kanban))) {
    state.tileLayout.order.push(localKanbanTileId(kanban));
  }
  saveLayoutToStorage();
  // Full re-render of board tiles to pick up the new kanban cleanly (clears board-group-tiles then re-renders groups + calendars + notes + kanbans)
  renderBoardGroups();
  showToast("Added local kanban tile (viewer / local only)");
}

// ---------------- Presence / Team feature (status, list, DMs, pinned top tile, idle, admin) ----------------

function loadPresenceUsersCache() {
  try {
    const raw = localStorage.getItem(PRESENCE_USERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.users)) {
      const age = Date.now() - (parsed.fetchedAt || 0);
      if (age < PRESENCE_CACHE_MAX_AGE_MS) return parsed;
    }
  } catch {}
  return null;
}

function savePresenceUsersCache(users) {
  try {
    const payload = { fetchedAt: Date.now(), users: Array.isArray(users) ? users : [] };
    localStorage.setItem(PRESENCE_USERS_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function clearPresenceUsersCache() {
  try { localStorage.removeItem(PRESENCE_USERS_CACHE_KEY); } catch {}
}

async function ensurePresenceUsersCache(force = false) {
  if (!force) {
    const cached = loadPresenceUsersCache();
    if (cached) {
      state.presenceUsersCache = cached;
      return cached.users;
    }
  }
  try {
    const res = await presenceFetch(`/api/presence/users`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load users");
    // The endpoint returns the CRM people response shape {response: [...] } or the array directly
    const list = data?.response ?? data?.result ?? data ?? [];
    const users = Array.isArray(list) ? list : [];
    savePresenceUsersCache(users);
    state.presenceUsersCache = { fetchedAt: Date.now(), users };
    return users;
  } catch (e) {
    // Fall back to any cached (even stale) or empty
    const cached = loadPresenceUsersCache();
    if (cached) {
      state.presenceUsersCache = cached;
      return cached.users;
    }
    return [];
  }
}

function getPresenceUserLabel(u) {
  if (!u) return "";
  return u.displayName || u.DisplayName || u.userName || u.UserName || (u.id != null ? String(u.id) : "User");
}

function getPresenceUserId(u) {
  if (!u) return "";
  return String(u.id ?? u.ID ?? u.userId ?? u.UserId ?? "");
}

// Helper for direct presence API calls (bypass the /api/proxy wrapper).
// Always sends credentials + X-OnlyOffice-Portal (when known) so server _portal_base
// works even if the python process has no PORTAL_URL env. Matches pattern used by
// user-profile direct fetches and api() wrapper.
function presenceFetch(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (state.portalUrl) headers["X-OnlyOffice-Portal"] = state.portalUrl;
  return fetch(path, { credentials: "same-origin", ...init, cache: "no-cache", headers });
}

async function fetchPresenceSnapshot() {
  try {
    const res = await presenceFetch(`/api/presence`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch presence");
    state.presenceData = data || null;
    updateClientPresenceCache(state.presenceData);
    if (state.presenceData) {
      if (!Array.isArray(state.presenceData.myRecentDms)) state.presenceData.myRecentDms = [];
      syncLastReadFromServer();
      injectTestMessages();
    }
    return state.presenceData;
  } catch {
    showCrmCrashBanner();
    state.presenceData = { users: [], myRecentDms: [] };
    updateClientPresenceCache(state.presenceData);
    return state.presenceData;
  }
}

function startPresencePolling() {
  stopPresencePolling();
  if (!state.presenceModalOpen && !state.hasPresenceTile) return;
  state.presencePollTimer = setInterval(async () => {
    if (!state.presenceModalOpen && !state.hasPresenceTile) {
      stopPresencePolling();
      return;
    }
    const snap = await fetchPresenceSnapshot();
    state.presenceData = snap;
    if (state.presenceModalOpen) {
      renderPresenceModal(snap);
      if (state.presenceSelectedUserId) {
        presenceFetch(`/api/presence/dm?with=${encodeURIComponent(state.presenceSelectedUserId)}`)
          .then(r => r.json())
          .then(d => {
            const log = $("#presence-dm-log");
            if (log) renderDMLog(log, (d && d.messages) || []);
          })
          .catch(() => {});
      }
    }
    if (state.hasPresenceTile) {
      renderPresenceTileCompact(snap);
      updatePresenceTileBadge();
      updatePresenceTileAdminButton();
    }
  }, PRESENCE_POLL_MS);
}

function stopPresencePolling() {
  if (state.presencePollTimer) {
    clearInterval(state.presencePollTimer);
    state.presencePollTimer = null;
  }
}

function startPresenceHeartbeats() {
  stopPresenceHeartbeats();
  // Send a heartbeat on visibility + periodic when the dashboard is visible
  const send = () => {
    presenceFetch(`/api/presence/heartbeat`, { method: "POST" }).catch(() => {});
    noteDashboardActivity();
  };
  // Fire-and-forget heartbeat for background tabs (not throttled by browsers)
  const sendBeacon = () => {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/presence/heartbeat");
      noteDashboardActivity();
    } else {
      send();
    }
  };
  // Initial heartbeat → then snapshot (sequential to ensure online status immediately)
  presenceFetch(`/api/presence/heartbeat`, { method: "POST" })
    .then(() => fetchPresenceSnapshot())
    .then(s => {
      state.presenceData = s;
      renderPresenceTileCompact(s);
      updatePresenceTileBadge();
      updatePresenceTileAdminButton();
    })
    .catch(() => {
      // Fallback: try snapshot even if heartbeat failed
      fetchPresenceSnapshot().then(s => {
        state.presenceData = s;
        renderPresenceTileCompact(s);
        updatePresenceTileBadge();
        updatePresenceTileAdminButton();
      }).catch(() => {});
    });
  noteDashboardActivity();
  // Periodic: 30s when visible, sendBeacon every 2min regardless
  state.presenceHeartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      send();
    } else {
      sendBeacon();
    }
  }, PRESENCE_HEARTBEAT_VISIBLE_MS);
  // Slower background beacon interval
  state.presenceHeartbeatBgTimer = setInterval(() => {
    if (document.visibilityState !== "visible") {
      sendBeacon();
    }
  }, PRESENCE_HEARTBEAT_BG_MS);
  // On visibility change — immediate heartbeat when returning to foreground
  if (state._presenceVisHandler) {
    document.removeEventListener("visibilitychange", state._presenceVisHandler);
  }
  const onVis = () => {
    if (document.visibilityState === "visible") send();
  };
  state._presenceVisHandler = onVis;
  document.addEventListener("visibilitychange", onVis, { once: false });
}

function stopPresenceHeartbeats() {
  if (state.presenceHeartbeatTimer) {
    clearInterval(state.presenceHeartbeatTimer);
    state.presenceHeartbeatTimer = null;
  }
  if (state.presenceHeartbeatBgTimer) {
    clearInterval(state.presenceHeartbeatBgTimer);
    state.presenceHeartbeatBgTimer = null;
  }
  if (state._presenceVisHandler) {
    document.removeEventListener("visibilitychange", state._presenceVisHandler);
    state._presenceVisHandler = null;
  }
}

function setupPresenceIdleAndAutoLogout() {
  if (state.presenceIdleTimer) {
    clearTimeout(state.presenceIdleTimer);
  }
  if (state.presenceIdleStatusTimer) {
    clearTimeout(state.presenceIdleStatusTimer);
  }

  const checkAndMaybeLogout = () => {
    const idleMs = Date.now() - lastDashboardActivityAt;
    if (idleMs >= PRESENCE_AUTO_LOGOUT_3H_MS) {
      (async () => {
        try {
          await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        } catch {}
        try { showToast("Logged out due to 3 hours of inactivity"); } catch {}
        try { showLogin(); } catch {}
      })();
      return;
    }
    const remaining = Math.max(30000, PRESENCE_AUTO_LOGOUT_3H_MS - idleMs);
    state.presenceIdleTimer = setTimeout(checkAndMaybeLogout, remaining);
  };

  // Auto-derived idle status: set "Idle" after 15 min of no activity
  const checkIdleStatus = () => {
    const idleMs = Date.now() - lastDashboardActivityAt;
    if (idleMs >= PRESENCE_IDLE_15M_MS) {
      // Only set idle if current status isn't already AFK
      const curStatus = state.presenceData?.me?.status || "";
      if (!curStatus.startsWith("AFK")) {
        updateInferredStatus("idle", "");
      }
    }
    const remaining = Math.max(30000, PRESENCE_IDLE_15M_MS - idleMs);
    state.presenceIdleStatusTimer = setTimeout(checkIdleStatus, remaining);
  };

  state.presenceIdleTimer = setTimeout(checkAndMaybeLogout, PRESENCE_AUTO_LOGOUT_3H_MS);
  state.presenceIdleStatusTimer = setTimeout(checkIdleStatus, PRESENCE_IDLE_15M_MS);
}

function updateInferredStatus(action, detail) {
  let text = "";
  switch (action) {
    case "edit": text = `Working on: ${detail}`; break;
    case "preview": text = `Reviewing: ${detail}`; break;
    case "note": text = `Just noted: ${detail}`; break;
    case "idle": text = "Idle"; break;
    case "available": text = ""; break;
  }
  if (text === undefined) return;
  if (state._suppressAutoStatus) return;
  presenceFetch("/api/presence/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: text, autoStatus: text, inferred: true }),
  }).then(() => {
    state.presenceData = null;
    fetchPresenceSnapshot().then(s => {
      state.presenceData = s;
      if (state.hasPresenceTile) {
        renderPresenceTileCompact(s);
        updatePresenceTileBadge();
        updatePresenceTileAdminButton();
      }
    }).catch(() => {});
  }).catch(() => {});

  // Schedule auto-status timeout: if user doesn't open/edit another deal within 5 min,
  // clear the auto-status so it doesn't look like they're still on that deal.
  // Only schedule for meaningful activities (not idle/available).
  if (action !== "idle" && action !== "available") {
    if (state._autoStatusTimeout) clearTimeout(state._autoStatusTimeout);
    state._autoStatusTimeout = setTimeout(() => {
      state._autoStatusTimeout = null;
      presenceFetch("/api/presence/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoStatus: "" }),
      }).then(() => {
        if (state.hasPresenceTile) {
          fetchPresenceSnapshot().then(s => {
            state.presenceData = s;
            renderPresenceTileCompact(s);
            updatePresenceTileBadge();
          }).catch(() => {});
        }
      }).catch(() => {});
    }, PRESENCE_AUTO_STATUS_TIMEOUT_MS);
  }
}

function updatePresenceHeaderBadge(snapshot = null) {
  // Now split: online count uses presence-online-badge (green), unread uses separate presence-unread-badge (blue top right)
  const data = snapshot || state.presenceData;
  const recent = (data && data.myRecentDms) || [];
  const users = (data && data.users) || [];
  const onlineCount = users.filter(u => u.online).length;
  const onlineBadge = $("#presence-online-badge");
  if (onlineBadge) {
    if (onlineCount > 0) {
      onlineBadge.textContent = onlineCount > 1 ? String(onlineCount) : "";
      onlineBadge.classList.remove("hidden");
      onlineBadge.title = `${onlineCount} user${onlineCount > 1 ? "s" : ""} online`;
    } else {
      onlineBadge.classList.add("hidden");
      onlineBadge.textContent = "";
    }
  }
  const unreadBadge = $("#presence-unread-badge");
  let unread = computeUnreadMessagesCount(recent);
  if (unreadBadge) {
    if (unread > 0) {
      unreadBadge.textContent = String(unread);
      unreadBadge.classList.remove("hidden");
      unreadBadge.title = `${unread} unread message${unread === 1 ? "" : "s"}`;
    } else {
      unreadBadge.classList.add("hidden");
      unreadBadge.textContent = "";
    }
  }
}

// --- Waiting messages (flashing indicator separate from online count) ---
let presenceLastRead = {};
let clientPresenceCache = {}; // id -> last known presence info; used to stabilize roster across partial snapshots

function updateClientPresenceCache(snap) {
  if (!snap || !Array.isArray(snap.users)) return;
  (snap.users || []).forEach(u => {
    const id = getPresenceUserId(u) || u.id || u.ID || u.userId;
    if (id) {
      const sid = String(id);
      clientPresenceCache[sid] = { ...(clientPresenceCache[sid] || {}), ...u };
    }
  });
}

function loadPresenceLastRead() {
  try {
    const raw = localStorage.getItem("oo_board_presence_last_read_v1");
    presenceLastRead = raw ? JSON.parse(raw) : {};
  } catch { presenceLastRead = {}; }
}
function savePresenceLastRead() {
  try {
    localStorage.setItem("oo_board_presence_last_read_v1", JSON.stringify(presenceLastRead));
  } catch {}
}

// Merge authoritative last-read times from server snapshot (enables same read/unread state across devices)
function syncLastReadFromServer() {
  try {
    const d = (state.presenceData && state.presenceData.lastReadDms) || {};
    for (const [k, v] of Object.entries(d || {})) {
      const key = String(k);
      let n = 0;
      if (typeof v === "number") n = v;
      else if (v) n = new Date(v).getTime() || 0;
      if (n > 0) presenceLastRead[key] = n;
    }
    savePresenceLastRead(); // keep localStorage in sync as a cache
  } catch {}
}

function computeHasWaitingMessages(recentDms) {
  if (!recentDms || !recentDms.length) return false;
  const me = String(state.currentUserId || "");
  for (const m of recentDms) {
    const from = m.from ? String(m.from) : "";
    if (from && from !== me) {
      const last = presenceLastRead[from] || 0;
      const ts = m.ts ? new Date(m.ts).getTime() : 0;
      if (ts > last) return true;
    }
  }
  return false;
}

function computeUnreadMessagesCount(recentDms) {
  if (!recentDms || !recentDms.length) return 0;
  const me = String(state.currentUserId || "");
  let count = 0;
  for (const m of recentDms) {
    const from = m.from ? String(m.from) : "";
    if (from && from !== me) {
      const last = presenceLastRead[from] || 0;
      const ts = m.ts ? new Date(m.ts).getTime() : 0;
      if (ts > last) count++;
    }
  }
  return count;
}

function updatePresenceHeaderIndicators(snapshot = null) {
  const snap = snapshot || state.presenceData;
  updatePresenceHeaderBadge(snap);

  const recent = (snap && snap.myRecentDms) || [];
  const hasWait = computeHasWaitingMessages(recent);

  const btn = $("#presence-btn");
  if (btn) {
    if (hasWait) {
      btn.classList.add("has-waiting-messages");
    } else {
      btn.classList.remove("has-waiting-messages");
    }

    // Self online indicator on the button icon itself (steady green, visible even if alone or count==1).
    // Separate from the count badge and the red waiting flash.
    let meOnline = false;
    const meId = String(state.currentUserId || "");
    if (snap && Array.isArray(snap.users)) {
      const candidates = [];
      if (meId) candidates.push(meId);
      if (snap.me && snap.me.id) candidates.push(String(snap.me.id));
      for (const cand of candidates) {
        const meEntry = snap.users.find(u => String(u.id || u.ID) === cand);
        if (meEntry && meEntry.online) {
          meOnline = true;
          break;
        }
      }
    }
    if (meOnline) {
      btn.classList.add("is-online");
    } else {
      btn.classList.remove("is-online");
    }

    // Ensure bottom-right green visual is the online users counter (the .presence-online-badge span as small green circle with number if >1).
    // Suppress the ::before pseudo dot to avoid overlapping "big" green or double visuals at bottom.
    const onlineBadgeEl = $("#presence-online-badge");
    if (onlineBadgeEl && !onlineBadgeEl.classList.contains("hidden")) {
      btn.classList.remove("is-online");
    }
  }
}

// Mark a conversation as read when the user opens/views the DM thread
function markPresenceDMRead(otherUserId) {
  if (!otherUserId) return;
  presenceLastRead[String(otherUserId)] = Date.now();
  savePresenceLastRead();
  // Persist to server so other devices (and future logins) see the same read state
  presenceFetch("/api/presence/last-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ with: String(otherUserId), at: new Date().toISOString() })
  }).catch(() => {});
}

function formatTimeAgo(iso) {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function ensureNotesToolbarRows(section) {
  if (!section || !section.classList.contains('notes-tile')) return;
  const bar = section.querySelector(':scope > .notes-tile-bar') || section.querySelector('.notes-tile-bar');
  if (!bar) return;
  const isNarrow = section.classList.contains('tile-quarter') || section.classList.contains('tile-half');
  let topRow = bar.querySelector('.notes-layout-top-row');
  const layouts = bar.querySelector('.tile-layout-btns');
  const removeB = bar.querySelector('.btn-remove-notes');
  const nameInput = bar.querySelector('.notes-tile-name');
  if (isNarrow) {
    if (!topRow) {
      topRow = document.createElement('div');
      topRow.className = 'notes-layout-top-row';
      bar.insertBefore(topRow, bar.firstChild);
    }
    // Keep the note name in the top row of the title bar even at quarter/half size
    // (layout buttons + remove also live here for narrow; other toolbar buttons stay below).
    if (nameInput && nameInput.parentNode !== topRow) {
      topRow.insertBefore(nameInput, topRow.firstChild);
    }
    if (layouts && layouts.parentNode !== topRow) topRow.appendChild(layouts);
    if (removeB && removeB.parentNode !== topRow) topRow.appendChild(removeB);
  } else if (topRow) {
    if (nameInput && nameInput.parentNode !== bar) bar.insertBefore(nameInput, bar.querySelector('.notes-tile-utils') || bar.firstChild);
    if (layouts) bar.appendChild(layouts);
    if (removeB) bar.appendChild(removeB);
    topRow.remove();
  }
}

function renderPresenceStatusPicker(container, currentStatus = "", onChange, inferred = false) {
  if (!container) return;
  container.innerHTML = "";

  const templates = [
    "DND - Estimating",
    "AFK - Lunch",
    "AFK - Pesky In-laws",
  ];

  const row = document.createElement("div");
  row.className = "presence-my-status";

  const label = document.createElement("span");
  label.textContent = "Status: ";
  label.style.marginRight = "0.3rem";
  label.style.color = "var(--muted)";
  row.appendChild(label);

  // Pull-down menu for status (as requested)
  const sel = document.createElement("select");
  sel.className = "presence-status-select";

  // If the server status is auto-derived (inferred=true), treat as "Online" in picker.
  // undefined means old server (no distinction) — show the status directly.
  const effectiveStatus = (inferred !== true && currentStatus) ? currentStatus : "Online";

  const onlineOpt = document.createElement("option");
  onlineOpt.value = "Online";
  onlineOpt.textContent = "Online";
  if (effectiveStatus === "Online") onlineOpt.selected = true;
  sel.appendChild(onlineOpt);

  templates.forEach(t => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    if (t === effectiveStatus) o.selected = true;
    sel.appendChild(o);
  });

  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Custom...";
  if (effectiveStatus && !["Online", ...templates].includes(effectiveStatus)) {
    customOpt.selected = true;
  }
  sel.appendChild(customOpt);

  const ta = document.createElement("textarea");
  ta.className = "presence-status-custom";
  const isCustomNow = effectiveStatus && !["Online", ...templates].includes(effectiveStatus);
  ta.style.display = isCustomNow ? "" : "none";
  ta.style.width = "220px";
  ta.style.height = "2.4em";
  ta.style.fontSize = "0.8rem";
  ta.maxLength = PRESENCE_CUSTOM_MAX;
  ta.placeholder = "Custom status (emojis OK)";
  if (isCustomNow) ta.value = effectiveStatus;

  const save = async () => {
    let val = sel.value;
    if (val === "__custom__") {
      val = (ta.value || "").trim().slice(0, PRESENCE_CUSTOM_MAX);
    }
    const isClear = !val || val === "Online";
    // Suppress auto-status when setting a manual status; re-enable on clear
    state._suppressAutoStatus = !isClear;
    try {
      const res = await presenceFetch(`/api/presence/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isClear ? { status: "Online" } : { status: val, inferred: false, autoStatus: "" }),
      });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const d = await res.json();
          if (d && d.error) errMsg = d.error;
          else if (d && d.detail) errMsg = d.detail;
        } catch (_) {}
        throw new Error(errMsg);
      }
      if (onChange) onChange(val);
    } catch (e) {
      try { showToast(`Could not set status: ${e && e.message ? e.message : 'server error'}`, true); } catch {}
    }
  };

  sel.addEventListener("change", () => {
    const showTa = sel.value === "__custom__";
    ta.style.display = showTa ? "" : "none";
    if (showTa && !ta.value && effectiveStatus && !["Online", ...templates].includes(effectiveStatus)) {
      ta.value = effectiveStatus;
    }
    if (!showTa) {
      save();
    }
  });

  ta.addEventListener("blur", () => {
    if (sel.value === "__custom__") save();
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && sel.value === "__custom__") {
      e.preventDefault();
      save();
    }
  });

  row.append(sel, ta);
  container.appendChild(row);
}

function renderPresenceUserList(container, snapshot, usersCache, onUserClick) {
  if (!container) return;
  container.innerHTML = "";

  // Base the list on the CRM portalUsers (same list used for "notify user" selects in notes/quick note/deal edit).
  // This guarantees all users (online or offline) are shown.
  let baseUsers = state.portalUsers && state.portalUsers.length ? state.portalUsers : [];
  if (!baseUsers.length) {
    baseUsers = usersCache || (state.presenceUsersCache ? state.presenceUsersCache.users : []);
  }

  const data = snapshot || state.presenceData || { users: [] };
  const presenceById = new Map();
  // Seed from client cache first (makes roster stable across polls that return partial user lists
  // from the backend; prevents "everyone offline" flashes then "just me").
  Object.entries(clientPresenceCache || {}).forEach(([id, p]) => {
    if (id) presenceById.set(String(id), p);
  });
  // Overlay fresh data from this snapshot (current info wins for online/idle/lastSeen).
  (data.users || []).forEach(p => {
    const id = getPresenceUserId(p) || p.id || p.ID;
    if (id) {
      const sid = String(id);
      presenceById.set(sid, { ...(presenceById.get(sid) || {}), ...p });
    }
  });

  const onlineRows = [];
  const afdRows = [];
  const offlineRows = [];

  baseUsers.forEach(u => {
    const id = getPresenceUserId(u);
    if (!id) return;
    const p = presenceById.get(String(id)) || {};
    const name = getPresenceUserLabel(u) || id;

    const row = document.createElement("div");
    row.className = "presence-user";
    row.dataset.userId = id;

    const dot = document.createElement("span");
    const isOnline = !!p.online;
    const isIdle = !!p.idle;
    const isAfd = !!p.afd;
    let dotClass = "offline";
    if (isOnline) dotClass = isIdle ? "idle" : "online";
    else if (isAfd) dotClass = "afd";
    dot.className = "presence-dot " + dotClass;

    const nm = document.createElement("span");
    nm.className = "presence-name";
    nm.textContent = name;

    // Detect server version: new server sends inferred/autoStatus fields
    const serverHasInferred = typeof p.inferred !== 'undefined';

    // Manual status next to name, bold, wrapped in parentheses (like the tile)
    const manualStatus = document.createElement("span");
    manualStatus.className = "presence-manual-status";
    if (serverHasInferred && p.status && p.inferred === false && p.status !== "Online") {
      manualStatus.textContent = `(${p.status})`;
    }

    const st = document.createElement("span");
    st.className = "presence-status";
    let statusText = "";
    if (p.autoStatus) {
      statusText = p.autoStatus;
    } else if (serverHasInferred) {
      if (p.inferred && p.status) {
        statusText = p.status;
      }
    } else if (p.status && p.status !== "Online") {
      // Old server fallback: show all non-Online statuses on the right
      statusText = p.status;
    }
    if (!isOnline) {
      const last = p.lastSeen || "";
      if (last) {
        statusText = (statusText ? statusText + " · " : "") + "last seen " + formatTimeAgo(last);
      } else {
        statusText = statusText || "last seen unknown";
      }
    }
    st.textContent = statusText;

    row.append(dot, nm, manualStatus, st);

    if (typeof onUserClick === "function") {
      row.addEventListener("click", () => onUserClick(id, name, p));
    }

    if (isOnline) {
      onlineRows.push(row);
    } else if (isAfd) {
      afdRows.push(row);
    } else {
      offlineRows.push(row);
    }
  });

  // Online section
  if (onlineRows.length) {
    const header = document.createElement("div");
    header.className = "presence-section-header";
    header.textContent = `Online (${onlineRows.length})`;
    container.appendChild(header);
    onlineRows.forEach(r => container.appendChild(r));
  }

  // Away from dashboard (AFD) — tabbed away (stale heartbeat) but not signed out (hb not cleared on logout)
  if (afdRows.length) {
    if (onlineRows.length) {
      const sep = document.createElement("div");
      sep.className = "presence-divider";
      container.appendChild(sep);
    }
    const header = document.createElement("div");
    header.className = "presence-section-header";
    header.textContent = `Away from dashboard (${afdRows.length})`;
    container.appendChild(header);
    afdRows.forEach(r => container.appendChild(r));
  }

  // Offline (signed out or no active dashboard heartbeat record)
  if (offlineRows.length) {
    if (onlineRows.length || afdRows.length) {
      const sep = document.createElement("div");
      sep.className = "presence-divider";
      container.appendChild(sep);
    }
    const header = document.createElement("div");
    header.className = "presence-section-header";
    header.textContent = `Offline (${offlineRows.length})`;
    container.appendChild(header);
    offlineRows.forEach(r => container.appendChild(r));
  }

  if (!baseUsers.length) {
    const empty = document.createElement("div");
    empty.className = "presence-empty";
    empty.style.padding = "0.5rem";
    empty.style.color = "var(--muted)";
    empty.textContent = "No users yet.";
    container.appendChild(empty);
  }
}

/**
 * Render the Messages inbox (past + recent DM conversations) into the given container.
 * Used when the "Messages" tab is active. Supports opening threads and per-convo clear (archive/delete).
 */
function renderPresenceInbox(container, recentDms, cache, snap) {
  if (!container) return;
  container.innerHTML = '';

  const recent = Array.isArray(recentDms) ? recentDms : [];
  if (!recent.length) {
    const empty = document.createElement('div');
    empty.className = 'presence-empty';
    empty.style.padding = '0.5rem';
    empty.style.color = 'var(--muted)';
    empty.textContent = 'No messages yet. Send or receive DMs and they will appear here (with delete option).';
    container.appendChild(empty);
    return;
  }

  const head = document.createElement('div');
  head.className = 'presence-section-header';
  head.textContent = 'Recent messages';
  container.appendChild(head);

  // Group latest per other party
  const byOther = new Map();
  const meIdStr = String(state.currentUserId || '');
  for (const m of recent) {
    const f = m.from != null ? String(m.from) : '';
    const t = m.to != null ? String(m.to) : '';
    const other = (f === meIdStr) ? t : f;
    if (!other || other === meIdStr) continue;
    if (!byOther.has(other)) byOther.set(other, m);
  }

  byOther.forEach((m, otherId) => {
    const row = document.createElement('div');
    row.className = 'presence-recent-row';

    // Compute if this thread has unread messages from the other party since we last read it.
    // Only count as unread if the *latest* message is incoming (from other) and newer than our last-read time.
    // This prevents threads where we sent the last message (e.g. after responding) from appearing unread on other devices.
    const otherLastRead = presenceLastRead[otherId] || 0;
    const msgTsNum = m.ts ? new Date(m.ts).getTime() : 0;
    const isIncomingLatest = String(m.from) !== meIdStr;
    let isUnread = isIncomingLatest && msgTsNum > otherLastRead;
    if (isUnread) {
      row.classList.add('unread');
    } else {
      row.classList.add('read');
    }

    let disp = otherId;
    const hit = cache.find(u => getPresenceUserId(u) === otherId) ||
                (snap.users || []).find(u => String(u.id || u.ID) === otherId);
    if (hit) disp = getPresenceUserLabel(hit) || disp;

    const who = document.createElement('span');
    who.className = 'presence-recent-who';
    who.textContent = disp;

    const snip = document.createElement('span');
    snip.className = 'presence-recent-snip';
    const rawTxt = (m.text || '').trim();
    const short = rawTxt.length > 48 ? rawTxt.slice(0, 48) + '…' : rawTxt;
    snip.textContent = (String(m.from) === meIdStr ? 'you: ' : '') + short;

    const tm = document.createElement('span');
    tm.className = 'presence-recent-time';
    tm.textContent = m.ts ? formatTimeAgo(m.ts) : '';

    const clr = document.createElement('button');
    clr.type = 'button';
    clr.className = 'btn btn-ghost btn-tiny presence-clear-btn';
    clr.textContent = '×';
    clr.title = 'Clear / archive this conversation';
    clr.addEventListener('click', (ev) => {
      ev.stopImmediatePropagation();
      clearPresenceConversation(otherId);
    });

    row.append(who, snip, tm, clr);
    row.addEventListener('click', () => {
      openPresenceDMThread(otherId, disp);
    });

    container.appendChild(row);
  });
}

/**
 * Render the DM conversation log with rich features:
 * - reply context (quoted previous message in smaller font)
 * - read receipts on my sent messages
 * - click to reply to any message
 */
function renderDMLog(logEl, msgs, onReplyClick) {
  if (!logEl) return;
  logEl.innerHTML = '';
  if (!msgs || !msgs.length) {
    const empty = document.createElement("div");
    empty.className = "presence-empty";
    empty.textContent = "No messages yet. Say hi!";
    logEl.appendChild(empty);
    return;
  }
  const msgByTs = new Map();
  msgs.forEach(m => { if (m && m.ts) msgByTs.set(String(m.ts), m); });
  const replyHandler = typeof onReplyClick === "function" ? onReplyClick : setPresenceReplyTo;

  msgs.forEach(m => {
    const div = document.createElement("div");
    const isMe = state.currentUserId != null && String(m.from) === String(state.currentUserId);
    div.className = "presence-msg " + (isMe ? "me" : "");

    // Reply context (quoted message) in smaller font
    // Prefer embedded reply_text (sent with the reply) so it always shows even for fresh sends or trimmed history.
    if (m.reply_to || m.reply_text) {
      let short = m.reply_text || "previous message";
      if (!m.reply_text && m.reply_to) {
        const key = String(m.reply_to);
        if (msgByTs.has(key)) {
          const orig = msgByTs.get(key);
          short = (orig.text || "").slice(0, 70) + ((orig.text || "").length > 70 ? "…" : "");
        }
      }
      const ctx = document.createElement("div");
      ctx.className = "presence-reply-context";
      ctx.innerHTML = `<span class="presence-reply-label">Replying to:</span> ${escapeHtml(short)}`;
      div.appendChild(ctx);
    }

    // Main message text
    const textEl = document.createElement("div");
    textEl.className = "presence-msg-text";
    textEl.textContent = m.text || "";
    div.appendChild(textEl);

    // Status under sent messages (me): "sent" (discreet, gray) if not yet read by recipient;
    // "read" (+ time if available) once read. Appears underneath the bubble text.
    if (isMe) {
      const status = document.createElement("div");
      status.className = "presence-msg-status";
      if (m.read) {
        let txt = "read";
        if (m.read_at) {
          txt += ` ${formatTimeAgo(m.read_at)}`;
        }
        status.textContent = txt;
        status.style.color = "#22c55e";
      } else {
        status.textContent = "sent";
        status.style.color = "#888";
      }
      div.appendChild(status);
    }

    // Click anywhere on the bubble to reply to this message
    div.addEventListener("click", () => {
      replyHandler(m);
    });

    logEl.appendChild(div);
  });
  logEl.scrollTop = logEl.scrollHeight;
  linkifyUrls(logEl);
}

/** Turn bare http/https URLs in text nodes into clickable links. */
function linkifyUrls(container) {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);
  for (const tnode of textNodes) {
    const txt = tnode.textContent || "";
    if (!txt || !/https?:\/\//i.test(txt)) continue;
    const parent = tnode.parentNode;
    if (parent && (parent.tagName === 'A' || parent.closest('a'))) continue;
    const frag = document.createDocumentFragment();
    let remaining = txt;
    const re = /(https?:\/\/[^\s<]+[^\s<,.!?:;)\]}>])/gi;
    let lastIdx = 0;
    let m;
    while ((m = re.exec(remaining)) !== null) {
      if (m.index > lastIdx) frag.appendChild(document.createTextNode(remaining.slice(lastIdx, m.index)));
      const a = document.createElement('a');
      a.href = m[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = m[1];
      frag.appendChild(a);
      lastIdx = re.lastIndex;
    }
    if (lastIdx < remaining.length) frag.appendChild(document.createTextNode(remaining.slice(lastIdx)));
    if (frag.childNodes.length) parent.replaceChild(frag, tnode);
  }
}

function setPresenceReplyTo(msg) {
  presenceCurrentReplyTo = msg;
  let preview = $("#presence-dm-reply-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.id = "presence-dm-reply-preview";
    preview.className = "presence-reply-preview";
    const dm = $("#presence-dm");
    const inputDiv = dm ? dm.querySelector(".presence-dm-input") : null;
    if (inputDiv && inputDiv.parentNode) {
      inputDiv.parentNode.insertBefore(preview, inputDiv);
    }
  }
  const short = (msg.text || "").slice(0, 50) + ((msg.text || "").length > 50 ? "…" : "");
  preview.innerHTML = `Replying to: <span>${escapeHtml(short)}</span> <button type="button" class="btn btn-ghost btn-tiny">×</button>`;
  const cancel = preview.querySelector("button");
  if (cancel) cancel.onclick = clearPresenceReplyTo;
}

function clearPresenceReplyTo() {
  presenceCurrentReplyTo = null;
  const preview = $("#presence-dm-reply-preview");
  if (preview && preview.parentNode) preview.parentNode.removeChild(preview);
}

/* --- Inline DM reply support (inside tile) --- */
let presenceInlineReplyTo = null;

function setPresenceInlineReplyTo(msg) {
  presenceInlineReplyTo = msg;
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  if (!tile) return;
  let preview = tile.querySelector("#presence-tile-dm-reply-preview");
  if (!preview) return;
  const short = (msg.text || "").slice(0, 50) + ((msg.text || "").length > 50 ? "…" : "");
  preview.innerHTML = `Replying to: <span>${escapeHtml(short)}</span> <button type="button" class="btn btn-ghost btn-tiny">×</button>`;
  preview.style.display = "";
  const cancel = preview.querySelector("button");
  if (cancel) cancel.onclick = clearPresenceInlineReplyTo;
}

function clearPresenceInlineReplyTo() {
  presenceInlineReplyTo = null;
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  if (!tile) return;
  const preview = tile.querySelector("#presence-tile-dm-reply-preview");
  if (preview) preview.style.display = "none";
}

function insertEmoji(textarea, emoji) {
  if (!textarea) return;
  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || textarea.value.length;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + emoji + val.substring(end);
  const pos = start + emoji.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.focus();
}

function showEmojiPicker(textarea, container) {
  if (!textarea || !container) return;
  // Remove any existing picker
  const existing = container.querySelector("#presence-emoji-picker");
  if (existing) { existing.remove(); return; }
  const picker = document.createElement("div");
  picker.id = "presence-emoji-picker";
  picker.className = "presence-emoji-picker";
  const emojis = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊","💋","💌","💘","💝","💖","💗","💓","💞","💕","💟","❣️","💔","❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💯","💢","💥","💫","💦","💨","🕳️","💣","💬","👁️‍🗨️","🗨️","🗯️","💭","💤","👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁️","👅","👄","💋"];
  emojis.forEach(em => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = em;
    b.className = "presence-emoji-btn";
    b.onclick = (e) => {
      e.stopPropagation();
      insertEmoji(textarea, em);
      picker.remove();
    };
    picker.appendChild(b);
  });
  container.appendChild(picker);
}

function showPopupEmojiPicker() {
  const ta = $("#presence-dm-text");
  const container = $("#presence-dm").querySelector(".presence-dm-input");
  showEmojiPicker(ta, container);
}

function showInlineEmojiPicker() {
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  if (!tile) return;
  const ta = tile.querySelector("#presence-tile-dm-text");
  if (!ta) return;
  // Toggle existing picker
  const existing = document.getElementById("presence-inline-emoji-picker");
  if (existing) { existing.remove(); return; }
  const picker = document.createElement("div");
  picker.id = "presence-inline-emoji-picker";
  picker.className = "presence-emoji-picker presence-emoji-picker-overlay";
  const emojis = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊","💋","💌","💘","💝","💖","💗","💓","💞","💕","💟","❣️","💔","❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💯","💢","💥","💫","💦","💨","🕳️","💣","💬","👁️‍🗨️","🗨️","🗯️","💭","💤","👍","👎","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁️","👅","👄","💋"];
  emojis.forEach(em => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = em;
    b.className = "presence-emoji-btn";
    b.onclick = (e) => {
      e.stopPropagation();
      insertEmoji(ta, em);
      picker.remove();
    };
    picker.appendChild(b);
  });
  // Position picker below the emoji button
  const emojiBtn = tile.querySelector("#presence-tile-dm-emoji");
  if (emojiBtn) {
    const rect = emojiBtn.getBoundingClientRect();
    picker.style.position = "fixed";
    picker.style.left = rect.left + "px";
    picker.style.top = (rect.bottom + 4) + "px";
    picker.style.zIndex = "99999";
    picker.style.width = "auto";
    picker.style.minWidth = "200px";
  }
  document.body.appendChild(picker);
  // Click away to close
  const closePicker = (e) => {
    if (!picker.contains(e.target) && e.target !== emojiBtn && !emojiBtn?.contains(e.target)) {
      picker.remove();
      document.removeEventListener("click", closePicker, true);
    }
  };
  setTimeout(() => document.addEventListener("click", closePicker, true), 0);
}

function enhanceDMInputForCurrentThread() {
  const dm = $("#presence-dm");
  if (!dm) return;
  const inputDiv = dm.querySelector(".presence-dm-input");
  if (!inputDiv || inputDiv.dataset.enhancedDm) return;
  inputDiv.dataset.enhancedDm = "1";
  const ta = inputDiv.querySelector("#presence-dm-text");
  const send = inputDiv.querySelector("#presence-dm-send");
  // Emoji selector button
  const emBtn = document.createElement("button");
  emBtn.type = "button";
  emBtn.className = "btn btn-ghost btn-tiny";
  emBtn.textContent = "😊";
  emBtn.title = "Insert emoji";
  emBtn.addEventListener("click", showPopupEmojiPicker);
  // Buttons wrapper for the right column (emoji + send, horizontal)
  const btnWrap = document.createElement("div");
  btnWrap.className = "presence-dm-input-buttons";
  btnWrap.appendChild(emBtn);
  if (send) {
    if (send.parentNode === inputDiv) inputDiv.removeChild(send);
    btnWrap.appendChild(send);
  }
  // Rebuild inputDiv for grid: ta (stays), btnWrap, picker (added later)
  // ta remains in place as first child
  inputDiv.appendChild(btnWrap);
  // Note: picker will be appended as third child and placed via grid-area
}

function renderPresenceAdminTab(container, snapshot) {
  if (!container) return;
  container.innerHTML = "";
  const data = snapshot || state.presenceData || {};
  const people = Array.isArray(data.users) ? data.users : [];

  const list = document.createElement("div");
  list.className = "presence-admin-list";

  people.forEach(p => {
    if (!p.admin) return; // only present for kenc and when the server included it
    const row = document.createElement("div");
    row.className = "presence-admin-row";
    const name = p.displayName || p.id;
    let html = `<strong>${escapeHtml(name)}</strong>`;
    if (p.admin.lastCrmMinutesAgo != null) html += ` · Last CRM (proxy): ${p.admin.lastCrmMinutesAgo}m`;
    if (p.admin.lastDashMinutesAgo != null) html += ` · Last dashboard: ${p.admin.lastDashMinutesAgo}m`;
    row.innerHTML = html;
    list.appendChild(row);
  });

  if (!list.children.length) {
    const note = document.createElement("div");
    note.textContent = "No additional admin activity recorded yet.";
    note.style.color = "var(--muted)";
    list.appendChild(note);
  }

  container.appendChild(list);
}

let presenceModalBound = false;
let presenceCurrentReplyTo = null;  // for quoting/replying to a specific previous message
let presenceHeaderPollTimer = null;

async function openPresenceModal() {
  const modal = $("#presence-modal");
  if (!modal) return;

  state.presenceModalOpen = true;
  modal.classList.remove("hidden");

  // Immediate render with whatever cache/snapshot we have (from login priming or prior).
  // This makes the button feel instant; no await on full CRM loadPortalUsers or first fetch.
  // The async ensure below will refresh the list + snap and re-render.
  const cachedUsers = state.presenceUsersCache ? state.presenceUsersCache.users : null;
  renderPresenceModal(state.presenceData, cachedUsers);

  // Background refresh (non-blocking for open)
  ensurePresenceUsersCache().then(async (users) => {
    const snap = await fetchPresenceSnapshot();
    renderPresenceModal(snap, users);
    updatePresenceHeaderIndicators(snap);
    startPresencePolling();
    startPresenceHeartbeats();
  }).catch(() => {});

  if (!presenceModalBound) {
    presenceModalBound = true;
    modal.querySelectorAll("[data-presence-dismiss]").forEach(el => {
      el.addEventListener("click", closePresenceModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) closePresenceModal();
    });

    // (pin-to-tile functionality removed per request -- feature is popup only via the header button)

    // DM back button
    const dmBack = $("#presence-dm-back");
    if (dmBack) dmBack.addEventListener("click", () => {
      state.presenceSelectedUserId = null;
      clearPresenceReplyTo();
      const snap = state.presenceData;
      const users = state.presenceUsersCache ? state.presenceUsersCache.users : [];
      renderPresenceModal(snap, users);
    });

    const dmSend = $("#presence-dm-send");
    if (dmSend) dmSend.addEventListener("click", sendPresenceDM);

    const dmTa = $("#presence-dm-text");
    if (dmTa) dmTa.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPresenceDM();
      }
    });
  }

  setupPresenceIdleAndAutoLogout();
}

// (pin-to-tile UI removed; no updatePresencePinToggleLabel)

function closePresenceModal() {
  const modal = $("#presence-modal");
  if (modal) modal.classList.add("hidden");
  state.presenceModalOpen = false;
  state.presenceSelectedUserId = null;
  stopPresencePolling();
  // Keep heartbeats running if the tile is visible
  if (!state.hasPresenceTile) {
    // optional: stopHeartbeats if we want to be strict, but heartbeats are cheap and useful for presence
  }
  const dm = $("#presence-dm");
  if (dm) dm.classList.add("hidden");
  clearPresenceReplyTo();
  // Reset admin area to hidden by default on close
  const adminEl = $("#presence-admin");
  if (adminEl) adminEl.classList.add("hidden");

  // Refresh the header unread indicator (blue bubble) now that the user may have clicked
  // messages inside the popup. Clicks on inbox rows or DM threads call markPresenceDMRead,
  // which updates presenceLastRead, so the next computeUnreadMessagesCount will reflect
  // only the still-unread ones. We do this on close as requested.
  updatePresenceHeaderIndicators(state.presenceData);
}

async function sendPresenceDM() {
  const ta = $("#presence-dm-text");
  if (!ta || !state.presenceSelectedUserId) return;
  const text = (ta.value || "").trim();
  if (!text) return;
  try {
    const body = { to: state.presenceSelectedUserId, text };
    if (presenceCurrentReplyTo) {
      body.reply_to = presenceCurrentReplyTo.ts;
      body.reply_text = (presenceCurrentReplyTo.text || "").slice(0, 100);
    }
    const res = await presenceFetch(`/api/presence/dm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const d = await res.json();
        if (d && d.error) errMsg = d.error;
        else if (d && d.detail) errMsg = d.detail;
      } catch (_) {}
      throw new Error(errMsg);
    }
    ta.value = "";
    clearPresenceReplyTo();
    // Acknowledge the thread up to now (so other devices see it as read; latest will be from self)
    markPresenceDMRead(state.presenceSelectedUserId);
    // Refresh the thread (re-render modal + explicitly refresh DM log with rich features)
    const snap = await fetchPresenceSnapshot();
    const users = state.presenceUsersCache ? state.presenceUsersCache.users : [];
    renderPresenceModal(snap, users);
    // Re-load the current DM log so new message + reply contexts + read receipts appear immediately
    if (state.presenceSelectedUserId) {
      presenceFetch(`/api/presence/dm?with=${encodeURIComponent(state.presenceSelectedUserId)}`)
        .then(r => r.json())
        .then(d => {
          const log = $("#presence-dm-log");
          if (log) renderDMLog(log, (d && d.messages) || []);
          enhanceDMInputForCurrentThread();
        })
        .catch(() => {});
    }
  } catch (e) {
    try { showToast(`Unable to send message: ${e && e.message ? e.message : 'server error'}`, true); } catch {}
  }
}

async function clearPresenceConversation(otherUserId, onDone) {
  if (!otherUserId) return;
  try {
    const res = await presenceFetch(`/api/presence/dm?with=${encodeURIComponent(otherUserId)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to clear");
    }
    // clear local read marker too
    try { delete presenceLastRead[String(otherUserId)]; savePresenceLastRead(); } catch {}
    if (typeof onDone === "function") onDone();
    else {
      // default: refresh current modal view
      const snap = await fetchPresenceSnapshot();
      const users = state.presenceUsersCache ? state.presenceUsersCache.users : [];
      renderPresenceModal(snap, users);
      updatePresenceHeaderIndicators(snap);
    }
  } catch (e) {
    try { showToast("Could not clear conversation", true); } catch {}
  }
}

function openPresenceDMThread(id, name) {
  const dmEl = $("#presence-dm");
  if (!dmEl || !id) return;
  state.presenceSelectedUserId = id;
  markPresenceDMRead(id);
  updatePresenceHeaderIndicators(state.presenceData);
  dmEl.classList.remove("hidden");
  $("#presence-dm-with").textContent = `Chat with ${name || id}`;

  // Ensure a Clear button in the thread header (for archive/delete of history)
  let clr = $("#presence-dm-clear");
  if (!clr) {
    clr = document.createElement("button");
    clr.id = "presence-dm-clear";
    clr.type = "button";
    clr.className = "btn btn-ghost btn-small";
    clr.textContent = "Clear";
    clr.style.marginLeft = "auto";
    const hdr = dmEl.querySelector(".presence-dm-header");
    if (hdr) hdr.appendChild(clr);
  }
  clr.onclick = () => {
    if (!state.presenceSelectedUserId) return;
    if (!confirm("Clear this conversation history?")) return;
    clearPresenceConversation(state.presenceSelectedUserId, () => {
      state.presenceSelectedUserId = null;
      const s = state.presenceData;
      const us = state.presenceUsersCache ? state.presenceUsersCache.users : [];
      renderPresenceModal(s, us);
    });
  };

  $("#presence-dm-log").innerHTML = "<div class=\"presence-loading\">Loading…</div>";
  // Clear any stale reply when (re)opening a thread
  clearPresenceReplyTo();
  presenceFetch(`/api/presence/dm?with=${encodeURIComponent(id)}`)
    .then(async (res) => {
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const d = await res.json();
          if (d && d.error) errMsg = d.error;
          else if (d && d.detail) errMsg = d.detail;
        } catch (_) {}
        throw new Error(errMsg);
      }
      return res.json();
    })
    .then(d => {
      const log = $("#presence-dm-log");
      const msgs = (d && d.messages) || [];
      renderDMLog(log, msgs);
      enhanceDMInputForCurrentThread();
    })
    .catch((err) => {
      const msg = (err && err.message) ? err.message : 'server error';
      $("#presence-dm-log").innerHTML = `<div class=\"presence-empty\">Could not load messages: ${escapeHtml ? escapeHtml(msg) : msg}</div>`;
    });
}

function renderPresenceModal(snapshot = null, usersCache = null) {
  const listEl = $("#presence-list");
  const myEl = $("#presence-my-status");
  const dmEl = $("#presence-dm");
  const adminEl = $("#presence-admin");
  const adminToggle = $("#presence-admin-toggle");
  if (!listEl || !myEl) return;

  const snap = snapshot || state.presenceData || { users: [] };
  const cache = usersCache || (state.presenceUsersCache ? state.presenceUsersCache.users : []);

  if (!state.presenceTab) state.presenceTab = 'team';

  // Ensure DM thread is hidden unless we have a selection (supports back button + re-renders)
  if (dmEl) {
    if (!state.presenceSelectedUserId) dmEl.classList.add("hidden");
  }

  // My status picker (top)
  const me = (snap.me || {});
  const myStatus = me.status || (snap.users || []).find(u => u.id === state.currentUserId)?.status || "";
  const myInferred = me.inferred !== undefined ? me.inferred : (snap.users || []).find(u => u.id === state.currentUserId)?.inferred;
  renderPresenceStatusPicker(myEl, myStatus, (newStatus) => {
    fetchPresenceSnapshot().then(s => {
      renderPresenceModal(s, cache);
      if (state.hasPresenceTile) {
        renderPresenceTileCompact(s);
        updatePresenceTileBadge();
        updatePresenceTileAdminButton();
        syncTileStatusSelect(s);
      }
    });
  }, myInferred);

  // Tabs (Team roster / Messages inbox). Wire clicks and active state.
  const tabsContainer = $("#presence-tabs");
  const activeTab = state.presenceTab || 'team';
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.presence-tab').forEach(btn => {
      const t = btn.dataset.tab || 'team';
      btn.classList.toggle('active', t === activeTab);
      if (!btn.dataset.tabBound) {
        btn.dataset.tabBound = '1';
        btn.addEventListener('click', () => {
          state.presenceTab = t;
          const s = state.presenceData || snap;
          const c = cache || (state.presenceUsersCache ? state.presenceUsersCache.users : []);
          renderPresenceModal(s, c);
        });
      }
    });
  }

  // Clear any stale non-tab recent section from previous impl
  const priorRecent = $("#presence-recent");
  if (priorRecent && priorRecent.parentNode) priorRecent.parentNode.removeChild(priorRecent);

  if (activeTab === 'messages') {
    // Messages tab: dedicated inbox of past/recent DMs with delete/archive
    listEl.innerHTML = '';
    const recentDms = Array.isArray(snap.myRecentDms) ? snap.myRecentDms : [];
    renderPresenceInbox(listEl, recentDms, cache, snap);
  } else {
    // Team tab: the user roster (online/offline + last seen)
    renderPresenceUserList(listEl, snap, cache, (id, name, p) => {
      // Open DM thread for this user (uses shared helper which wires Clear too)
      openPresenceDMThread(id, name);
    });
  }

  // Admin area (kenc only): hidden by default, toggleable via button that says "Admin" when hidden.
  // Strictly gated to kenc@vanguardadj.com email (both client and server-side in snapshot).
  if (adminEl && adminToggle) {
    const isKenc = (state.currentUserEmail || "").toLowerCase() === "kenc@vanguardadj.com";
    const hasAdminData = snap && snap.users && snap.users.some(u => u.admin);
    const onTeamTab = activeTab === 'team';
    if (isKenc && hasAdminData && onTeamTab) {
      adminToggle.classList.remove("hidden");
      const isVisible = !adminEl.classList.contains("hidden");
      adminToggle.textContent = isVisible ? "Hide Admin" : "Admin";

      // Bind toggle once (safe across re-renders)
      if (!adminToggle.dataset.adminBound) {
        adminToggle.dataset.adminBound = "1";
        adminToggle.addEventListener("click", () => {
          if (adminEl.classList.contains("hidden")) {
            adminEl.classList.remove("hidden");
            if (!adminEl.dataset.rendered) {
              renderPresenceAdminTab(adminEl, snap);
              adminEl.dataset.rendered = "1";
            }
            adminToggle.textContent = "Hide Admin";
          } else {
            adminEl.classList.add("hidden");
            adminToggle.textContent = "Admin";
          }
        });
      }

      // If currently visible (user had it open), refresh the content on re-render
      if (isVisible) {
        renderPresenceAdminTab(adminEl, snap);
      }
    } else {
      adminToggle.classList.add("hidden");
      adminEl.classList.add("hidden");
    }
  }

  // (no pin toggle label update -- feature removed)
}

function renderPresenceTileCompact(snapshot = null) {
  const body = $("#presence-tile-team-body");
  if (!body) return;
  const snap = snapshot || state.presenceData || { users: [] };
  const allUsers = snap.users || [];

  // Split into online vs offline groups
  const onlineUsers = allUsers.filter(u => u.online || u.idle);
  const offlineUsers = allUsers.filter(u => !u.online && !u.idle);

  body.innerHTML = "";
  const list = document.createElement("div");
  list.className = "presence-list-compact";

  const renderUserRow = (u) => {
    const row = document.createElement("div");
    row.className = "presence-user";

    const dot = document.createElement("span");
    let dcls = "offline";
    // Treat client-side idle (15 min) as idle dot too
    const isClientIdle = u.online && (u.autoStatus === "Idle" || (u.inferred && u.status === "Idle"));
    if (u.online) dcls = (u.idle || isClientIdle) ? "idle" : "online";
    else if (u.afd) dcls = "afd";
    dot.className = "presence-dot " + dcls;

    const nm = document.createElement("span");
    nm.className = "presence-name";
    nm.textContent = u.displayName || u.id || "";

    // Detect server version: new server sends inferred/autoStatus fields
    const serverHasInferred = typeof u.inferred !== 'undefined';

    // Manual status: directly right of name, bold, wrapped in parentheses
    const manualStatus = document.createElement("span");
    manualStatus.className = "presence-manual-status";
    if (serverHasInferred && u.status && u.inferred === false && u.status !== "Online") {
      manualStatus.textContent = `(${u.status})`;
    }

    // Auto/inferred status: stays on right side, muted
    const st = document.createElement("span");
    st.className = "presence-status";
    let statusText = "";
    if (u.autoStatus) {
      statusText = u.autoStatus;
    } else if (serverHasInferred) {
      if (u.inferred && u.status) {
        statusText = u.status;
      }
    } else if (u.status && u.status !== "Online") {
      // Old server fallback: show all non-Online statuses on the right
      statusText = u.status;
    }
    // Last seen for offline users
    if (!u.online && !u.afd && u.lastSeen) {
      statusText = (statusText ? statusText + " · " : "") + "last seen " + formatTimeAgo(u.lastSeen);
    }
    st.textContent = statusText;

    row.append(dot, nm, manualStatus, st);
    row.addEventListener("click", () => {
      switchToPresenceMessagesTab();
      openDMInline(u.id, u.displayName);
    });
    list.appendChild(row);
  };

  // Online users first
  onlineUsers.forEach(renderUserRow);

  // Divider between online and offline
  if (onlineUsers.length && offlineUsers.length) {
    const divider = document.createElement("div");
    divider.className = "presence-tile-divider";
    list.appendChild(divider);
  }

  // Offline users
  offlineUsers.forEach(renderUserRow);

  if (!allUsers.length) {
    const empty = document.createElement("div");
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "0.75rem";
    empty.textContent = "No team data yet.";
    body.appendChild(empty);
    syncTileStatusSelect(snap);
    return;
  }

  body.appendChild(list);
  syncTileStatusSelect(snap);
}

function renderPresenceTile() {
  const tileId = "tile-presence";
  let tile = document.querySelector(`[data-tile-id="${tileId}"]`);
  if (!tile) {
    tile = document.createElement("section");
    tile.className = "dashboard-tile panel presence-panel";
    tile.dataset.tileId = tileId;
    tile.dataset.tileLabel = "Team";
    tile.innerHTML = `
      <div class="panel-header panel-header-presence">
        <div class="presence-tile-toolbar">
          <select id="presence-tile-status" class="presence-status-select-tile" title="Set your status">
            <option value="Online">Online</option>
            <option value="DND - Estimating">DND - Estimating</option>
            <option value="AFK - Lunch">AFK - Lunch</option>
            <option value="AFK - Other">AFK - Other</option>
            <option value="__custom__">Custom...</option>
          </select>
          <div id="presence-tile-custom-wrap" class="presence-custom-wrap" style="display:none;">
            <input type="text" id="presence-tile-custom-input" class="presence-custom-input" placeholder="Custom status…" maxlength="120" />
            <button type="button" id="presence-tile-custom-ok" class="presence-custom-ok">✓</button>
            <button type="button" id="presence-tile-custom-cancel" class="presence-custom-cancel">✕</button>
          </div>
          <button type="button" id="presence-tile-admin-btn" class="presence-admin-toggle-tile hidden" title="Admin view">Admin</button>
        </div>
        <span id="presence-tile-unread-flash" class="presence-unread-flash hidden" title="Unread messages">✉</span>
        <button type="button" id="presence-tile-popup-btn" class="presence-popup-btn" title="Open team viewer in popup">⤢</button>
      </div>
      <div class="presence-tile-tabs">
        <button type="button" class="presence-tile-tab active" data-tab="team">Team</button>
        <button type="button" class="presence-tile-tab" data-tab="messages">Messages<span id="presence-tile-msg-badge" class="msg-badge hidden">0</span></button>
      </div>
      <div id="presence-tile-team-body" class="presence-tile-body presence-tile-tab-content active"></div>
      <div id="presence-tile-messages-body" class="presence-tile-body presence-tile-tab-content" style="display:none;"></div>
      <div id="presence-tile-dm-inline" class="presence-tile-body" style="display:none;">
        <div class="presence-dm-inline-header">
          <button type="button" id="presence-tile-dm-back" class="presence-dm-inline-back">← Back</button>
          <span id="presence-tile-dm-title" class="presence-dm-inline-title">Chat</span>
        </div>
        <div id="presence-tile-dm-log" class="presence-dm-inline-log"></div>
        <div id="presence-tile-dm-reply-preview" class="presence-reply-preview" style="display:none;"></div>
        <div class="presence-dm-inline-input">
          <input type="text" id="presence-tile-dm-text" class="presence-dm-inline-field" placeholder="Type a message…" />
          <div class="presence-dm-inline-buttons">
            <button type="button" id="presence-tile-dm-emoji" class="presence-emoji-inline-btn" title="Insert emoji">😊</button>
            <button type="button" id="presence-tile-dm-send" class="presence-dm-inline-send">Send</button>
          </div>
        </div>
      </div>
      <div id="presence-tile-admin" class="presence-admin hidden" style="padding:0.5rem 0.75rem;font-size:0.78rem;color:var(--muted);"></div>
    `;
    $("#dashboard-tiles")?.appendChild(tile);
    bindTileChrome(tile, tileId);
    bindPresenceTileControls(tile);
  }
  renderPresenceTileCompact();
  return tile;
}

function bindPresenceTileControls(tile) {
  const statusSel = tile.querySelector("#presence-tile-status");
  const customWrap = tile.querySelector("#presence-tile-custom-wrap");
  const customInput = tile.querySelector("#presence-tile-custom-input");
  const customOk = tile.querySelector("#presence-tile-custom-ok");
  const customCancel = tile.querySelector("#presence-tile-custom-cancel");

  function confirmCustomStatus(val) {
    statusSel.value = val || "Online";
    customWrap.style.display = "none";
    statusSel.style.display = "";
    // Clear to Online — re-enable auto-status
    if (!val || val === "Online") {
      state._suppressAutoStatus = false;
      presenceFetch("/api/presence/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Online" }),
      }).then(() => {
        fetchPresenceSnapshot().then(s => {
          state.presenceData = s;
          renderPresenceTileCompact(s);
          updatePresenceTileBadge();
          updatePresenceTileAdminButton();
        }).catch(() => {});
      }).catch(() => {});
      return;
    }
    // Set manual status — suppress auto-status updates, clear accumulated autoStatus
    state._suppressAutoStatus = true;
    presenceFetch("/api/presence/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: val, inferred: false, autoStatus: "" }),
    }).then(() => {
      fetchPresenceSnapshot().then(s => {
        state.presenceData = s;
        renderPresenceTileCompact(s);
        updatePresenceTileBadge();
        updatePresenceTileAdminButton();
      }).catch(() => {});
    }).catch(() => {});
  }

  function cancelCustomStatus() {
    customWrap.style.display = "none";
    statusSel.style.display = "";
    statusSel.value = "";
  }

  if (statusSel && !statusSel.dataset.bound) {
    statusSel.dataset.bound = "1";
    statusSel.addEventListener("change", () => {
      if (statusSel.value === "__custom__") {
        statusSel.style.display = "none";
        customWrap.style.display = "";
        customInput.value = "";
        customInput.focus();
        return;
      }
      confirmCustomStatus(statusSel.value);
    });
  }

  if (customOk && !customOk.dataset.bound) {
    customOk.dataset.bound = "1";
    customOk.addEventListener("click", () => {
      confirmCustomStatus(customInput.value.trim().slice(0, PRESENCE_CUSTOM_MAX));
    });
  }

  if (customCancel && !customCancel.dataset.bound) {
    customCancel.dataset.bound = "1";
    customCancel.addEventListener("click", cancelCustomStatus);
  }

  if (customInput && !customInput.dataset.bound) {
    customInput.dataset.bound = "1";
    customInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmCustomStatus(customInput.value.trim().slice(0, PRESENCE_CUSTOM_MAX));
      } else if (e.key === "Escape") {
        cancelCustomStatus();
      }
    });
  }

  // Tab switching
  const tabBar = tile.querySelector(".presence-tile-tabs");
  if (tabBar && !tabBar.dataset.bound) {
    tabBar.dataset.bound = "1";
    tabBar.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".presence-tile-tab");
      if (!tabBtn) return;
      const tabId = tabBtn.dataset.tab;
      if (!tabId) return;

      // Update active tab
      tabBar.querySelectorAll(".presence-tile-tab").forEach(b => b.classList.remove("active"));
      tabBtn.classList.add("active");

      // Switch content
      const teamBody = tile.querySelector("#presence-tile-team-body");
      const msgBody = tile.querySelector("#presence-tile-messages-body");
      if (tabId === "messages") {
        if (teamBody) teamBody.style.display = "none";
        if (msgBody) {
          msgBody.style.display = "";
          renderPresenceTileMessages();
        }
        tile.classList.add("presence-tile-expanded");
      } else {
        if (teamBody) teamBody.style.display = "";
        if (msgBody) msgBody.style.display = "none";
        tile.classList.remove("presence-tile-expanded");
      }
    });
  }

  const adminBtn = tile.querySelector("#presence-tile-admin-btn");
  if (adminBtn && !adminBtn.dataset.bound) {
    adminBtn.dataset.bound = "1";
    adminBtn.addEventListener("click", () => {
      const adminEl = tile.querySelector("#presence-tile-admin");
      if (!adminEl) return;
      if (adminEl.classList.contains("hidden")) {
        adminEl.classList.remove("hidden");
        renderPresenceAdminInTile(adminEl);
        adminBtn.textContent = "Hide Admin";
      } else {
        adminEl.classList.add("hidden");
        adminBtn.textContent = "Admin";
      }
    });
  }

  // Popup button - opens full team viewer modal
  const popupBtn = tile.querySelector("#presence-tile-popup-btn");
  if (popupBtn && !popupBtn.dataset.bound) {
    popupBtn.dataset.bound = "1";
    popupBtn.addEventListener("click", () => {
      openPresenceModal();
    });
  }

  // Inline DM controls
  const dmBack = tile.querySelector("#presence-tile-dm-back");
  if (dmBack && !dmBack.dataset.bound) {
    dmBack.dataset.bound = "1";
    dmBack.addEventListener("click", closeDMInline);
  }
  const dmSend = tile.querySelector("#presence-tile-dm-send");
  if (dmSend && !dmSend.dataset.bound) {
    dmSend.dataset.bound = "1";
    dmSend.addEventListener("click", sendDMInlineMessage);
  }
  const dmEmoji = tile.querySelector("#presence-tile-dm-emoji");
  if (dmEmoji && !dmEmoji.dataset.bound) {
    dmEmoji.dataset.bound = "1";
    dmEmoji.addEventListener("click", showInlineEmojiPicker);
  }
  const dmText = tile.querySelector("#presence-tile-dm-text");
  if (dmText && !dmText.dataset.bound) {
    dmText.dataset.bound = "1";
    dmText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendDMInlineMessage();
      }
    });
  }
}

function renderPresenceAdminInTile(container) {
  if (!container) return;
  container.innerHTML = "";
  const snap = state.presenceData || { users: [] };
  const people = Array.isArray(snap.users) ? snap.users : [];
  let html = "";
  people.forEach(p => {
    if (!p.admin) return;
    const name = p.displayName || p.id;
    html += `<div style="margin-bottom:0.25rem;"><strong>${escapeHtml(name)}</strong>`;
    if (p.admin.lastHeartbeatMinutesAgo != null) html += ` · HB: ${p.admin.lastHeartbeatMinutesAgo}m`;
    if (p.admin.lastCrmMinutesAgo != null) html += ` · CRM: ${p.admin.lastCrmMinutesAgo}m`;
    if (p.admin.lastDashMinutesAgo != null) html += ` · Dash: ${p.admin.lastDashMinutesAgo}m`;
    html += `</div>`;
  });
  if (!html) html = '<div style="color:var(--muted);">No admin activity recorded yet.</div>';
  container.innerHTML = html;
}

function renderPresenceTileMessages() {
  const body = $("#presence-tile-messages-body");
  if (!body) return;
  const snap = state.presenceData || {};
  const recentDms = Array.isArray(snap.myRecentDms) ? snap.myRecentDms : [];

  body.innerHTML = "";

  if (!recentDms.length) {
    const empty = document.createElement("div");
    empty.className = "presence-empty";
    empty.style.padding = "0.5rem";
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "0.78rem";
    empty.textContent = "No messages yet.";
    body.appendChild(empty);
    return;
  }

  const meId = String(state.currentUserId || "");
  const byOther = new Map();
  recentDms.forEach(m => {
    const otherId = String(m.from) === meId ? String(m.to) : String(m.from);
    if (!byOther.has(otherId) || new Date(m.ts) > new Date(byOther.get(otherId).ts)) {
      byOther.set(otherId, m);
    }
  });

  const users = Array.isArray(snap.users) ? snap.users : [];
  byOther.forEach((m, otherId) => {
    const row = document.createElement("div");
    row.className = "presence-recent-row";

    const userEntry = users.find(u => String(u.id) === otherId);
    const disp = userEntry ? (userEntry.displayName || userEntry.id) : otherId;

    const rawTxt = String(m.text || "");
    const short = rawTxt.length > 48 ? rawTxt.slice(0, 48) + "…" : rawTxt;

    const otherLastRead = presenceLastRead[otherId] || (snap.lastReadDms && snap.lastReadDms[otherId] ? new Date(snap.lastReadDms[otherId]).getTime() : 0);
    const msgTsNum = new Date(m.ts).getTime();
    const isIncomingLatest = String(m.from) !== meId;
    let isUnread = isIncomingLatest && msgTsNum > otherLastRead;

    if (isUnread) row.classList.add("unread");
    else row.classList.add("read");

    const who = document.createElement("span");
    who.className = "presence-recent-who";
    who.textContent = disp;

    const snip = document.createElement("span");
    snip.className = "presence-recent-snip";
    snip.textContent = (String(m.from) === meId ? "you: " : "") + short;

    const tm = document.createElement("span");
    tm.className = "presence-recent-time";
    tm.textContent = m.ts ? formatTimeAgo(m.ts) : "";

    row.append(who, snip, tm);
    row.addEventListener("click", () => {
      openDMInline(otherId, disp);
    });
    body.appendChild(row);
  });
}

function switchToPresenceMessagesTab() {
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  if (!tile) return;
  const tabBar = tile.querySelector(".presence-tile-tabs");
  if (!tabBar) return;
  const teamBody = tile.querySelector("#presence-tile-team-body");
  const msgBody = tile.querySelector("#presence-tile-messages-body");
  const dmInline = tile.querySelector("#presence-tile-dm-inline");

  tabBar.querySelectorAll(".presence-tile-tab").forEach(b => b.classList.remove("active"));
  const msgTab = tabBar.querySelector('[data-tab="messages"]');
  if (msgTab) msgTab.classList.add("active");

  if (teamBody) teamBody.style.display = "none";
  if (msgBody) msgBody.style.display = "";
  if (dmInline) dmInline.style.display = "none";
  tile.classList.add("presence-tile-expanded");
  renderPresenceTileMessages();
}

function openDMInline(userId, userName) {
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  if (!tile) return;
  const msgBody = tile.querySelector("#presence-tile-messages-body");
  const dmInline = tile.querySelector("#presence-tile-dm-inline");
  const dmTitle = tile.querySelector("#presence-tile-dm-title");
  const dmLog = tile.querySelector("#presence-tile-dm-log");
  if (!dmInline || !dmLog) return;

  state.presenceSelectedUserId = userId;
  markPresenceDMRead(userId);
  updatePresenceTileBadge();
  clearPresenceInlineReplyTo();

  if (msgBody) msgBody.style.display = "none";
  dmInline.style.display = "";
  if (dmTitle) dmTitle.textContent = userName || userId;
  dmLog.innerHTML = '<div class="presence-loading">Loading…</div>';

  presenceFetch(`/api/presence/dm?with=${encodeURIComponent(userId)}`)
    .then(res => res.json())
    .then(d => {
      const msgs = (d && d.messages) || [];
      renderDMLog(dmLog, msgs, setPresenceInlineReplyTo);
    })
    .catch(err => {
      dmLog.innerHTML = `<div class="presence-empty">Could not load messages: ${escapeHtml(err.message || "Unknown error")}</div>`;
    });
}

function closeDMInline() {
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  if (!tile) return;
  const msgBody = tile.querySelector("#presence-tile-messages-body");
  const dmInline = tile.querySelector("#presence-tile-dm-inline");
  if (dmInline) dmInline.style.display = "none";
  if (msgBody) {
    msgBody.style.display = "";
    renderPresenceTileMessages();
  }
  state.presenceSelectedUserId = null;
  clearPresenceInlineReplyTo();
}

function sendDMInlineMessage() {
  const uid = state.presenceSelectedUserId;
  const tile = document.querySelector('[data-tile-id="tile-presence"]');
  const textEl = tile?.querySelector("#presence-tile-dm-text");
  if (!uid || !textEl) return;
  const text = (textEl.value || "").trim();
  if (!text) return;

  const body = { to: uid, text };
  if (presenceInlineReplyTo) {
    body.reply_to = presenceInlineReplyTo.ts;
    body.reply_text = (presenceInlineReplyTo.text || "").slice(0, 100);
  }

  presenceFetch("/api/presence/dm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(res => {
    if (!res.ok) throw new Error("Failed to send");
    textEl.value = "";
    clearPresenceInlineReplyTo();
    // Refresh the inline log
    presenceFetch(`/api/presence/dm?with=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(d => {
        const tile = document.querySelector('[data-tile-id="tile-presence"]');
        const log = tile?.querySelector("#presence-tile-dm-log");
        if (log) renderDMLog(log, (d && d.messages) || [], setPresenceInlineReplyTo);
      })
      .catch(() => {});
    // Update badge
    fetchPresenceSnapshot().then(s => {
      state.presenceData = s;
      updatePresenceTileBadge();
    }).catch(() => {});
  }).catch(err => {
    showToast(`Could not send message: ${err.message}`, true);
  });
}

function updatePresenceTileBadge() {
  const snap = state.presenceData;
  if (!snap) return;
  const recent = Array.isArray(snap.myRecentDms) ? snap.myRecentDms : [];
  const unread = computeUnreadMessagesCount(recent);
  const badge = $("#presence-tile-msg-badge");
  if (badge) {
    if (unread > 0) {
      badge.textContent = String(unread);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
  // Flashing indicator in team title bar
  const flashEl = $("#presence-tile-unread-flash");
  if (flashEl) {
    if (unread > 0) {
      flashEl.classList.remove("hidden");
      flashEl.title = `${unread} unread message${unread > 1 ? "s" : ""}`;
    } else {
      flashEl.classList.add("hidden");
    }
  }
  // Document title indicator
  const baseTitle = window.__presenceBaseTitle || "CRM Kanban";
  if (!window.__presenceBaseTitle) {
    window.__presenceBaseTitle = document.title || baseTitle;
  }
  if (unread > 0) {
    document.title = `(${unread}) ${window.__presenceBaseTitle}`;
  } else {
    document.title = window.__presenceBaseTitle;
  }
  // Update toolbar count badge with online user count
  const users = Array.isArray(snap.users) ? snap.users : [];
  const onlineCount = users.filter(u => u.online).length;
  updatePanelTileCount("tile-presence", onlineCount);

  // Refresh messages tab if visible
  const msgBody = $("#presence-tile-messages-body");
  if (msgBody && msgBody.style.display !== "none") {
    renderPresenceTileMessages();
  }
}

function updatePresenceTileAdminButton() {
  const btn = $("#presence-tile-admin-btn");
  if (!btn) return;
  const isKenc = (state.currentUserEmail || "").toLowerCase() === "kenc@vanguardadj.com";
  const snap = state.presenceData || {};
  const hasAdminData = Array.isArray(snap.users) && snap.users.some(u => u.admin);
  btn.classList.toggle("hidden", !(isKenc && hasAdminData));
}

function syncTileStatusSelect(snap) {
  const sel = $("#presence-tile-status");
  if (!sel) return;
  const data = snap || state.presenceData || {};
  const me = data.me || {};
  const cur = me.status || (data.users || []).find(u => u.id === state.currentUserId)?.status || "";
  const inferred = me.inferred !== undefined ? me.inferred : (data.users || []).find(u => u.id === state.currentUserId)?.inferred;
  // Ensure custom input is closed on re-sync
  const customWrap = $("#presence-tile-custom-wrap");
  if (customWrap && customWrap.style.display !== "none") {
    customWrap.style.display = "none";
    sel.style.display = "";
  }
  // If inferred is undefined (old server), let cur decide; never show auto-derived statuses
  if (inferred === true || !cur || cur === "Online") {
    sel.value = "Online";
  } else {
    sel.value = cur;
  }
}

// Temporary test helper: inject a fake unread DM to show the badge
window.__testUnreadMessages = [];
window.testUnreadMessage = function testUnreadMessage() {
  if (!state.presenceData) state.presenceData = { users: [], myRecentDms: [] };
  if (!Array.isArray(state.presenceData.myRecentDms)) state.presenceData.myRecentDms = [];
  const snap = state.presenceData;
  const otherUser = (snap.users || []).find(u => u.id !== state.currentUserId) || { id: "dummy", displayName: "Test User" };
  const otherId = String(otherUser.id);
  // Clear any stored last-read for this user so the message appears unread
  delete presenceLastRead[otherId];
  savePresenceLastRead();
  const fakeMsg = {
    from: otherId,
    to: String(state.currentUserId || ""),
    text: "This is a test unread message! 🎉",
    ts: new Date().toISOString(),
  };
  // Store in a safe place that survives snapshot refreshes
  window.__testUnreadMessages.push(fakeMsg);
  snap.myRecentDms.push(fakeMsg);
  updatePresenceTileBadge();
  showToast("Test unread message added from " + (otherUser.displayName || otherId), false);
  // Re-inject after any snapshot fetch (which overwrites myRecentDms)
  injectTestMessages();
};
function injectTestMessages() {
  if (!window.__testUnreadMessages.length) return;
  if (state.presenceData && Array.isArray(state.presenceData.myRecentDms)) {
    // Don't re-add if already present (check ts)
    const existingTs = new Set(state.presenceData.myRecentDms.map(m => m.ts));
    for (const msg of window.__testUnreadMessages) {
      if (!existingTs.has(msg.ts)) {
        state.presenceData.myRecentDms.push(msg);
      }
    }
  }
}

// Called from mount logic (similar to renderFeedTile / renderTasksTile)
// Note: renderPresenceTile() is now defined above with full toolbar

function updatePresenceInstalledFlagFromLayout() {
  const order = (state.tileLayout && state.tileLayout.order) || [];
  const pinned = (state.tileLayout && state.tileLayout.pinned) || {};
  state.hasPresenceTile = order.includes("tile-presence") && !!pinned["tile-presence"];
}

// Called from the post-login / refresh path
function ensurePresenceOnLogin() {
  ensurePresenceUsersCache().catch(() => {});
  loadPresenceLastRead();
  // Always enable the team tile
  state.hasPresenceTile = true;
  try {
    const layout = state.tileLayout || {};
    if (!layout.pinned) layout.pinned = {};
    layout.pinned["tile-presence"] = true;
    if (!layout.order.includes("tile-presence")) layout.order.push("tile-presence");
    state.tileLayout = layout;
    saveLayoutToStorage();
  } catch {}
  startPresenceHeartbeats();
  if (presenceHeaderPollTimer) clearInterval(presenceHeaderPollTimer);
  presenceHeaderPollTimer = setInterval(() => {
    fetchPresenceSnapshot().then(s => {
      state.presenceData = s;
      renderPresenceTileCompact(s);
      updatePresenceTileBadge();
      updatePresenceTileAdminButton();
    }).catch(() => {});
  }, 30000);
  setupPresenceIdleAndAutoLogout();
}

/* ==================== DM Popup Modal ==================== */

function openDMPopup(userId, userName) {
  const modal = $("#dm-popup-modal");
  if (!modal) return;
  state.presenceSelectedUserId = userId;
  markPresenceDMRead(userId);
  updatePresenceTileBadge();

  $("#dm-popup-title").textContent = `Chat with ${userName || userId}`;
  $("#dm-popup-log").innerHTML = '<div class="presence-loading">Loading…</div>';
  modal.classList.remove("hidden");
  modal.classList.remove("dm-popup-large");

  presenceFetch(`/api/presence/dm?with=${encodeURIComponent(userId)}`)
    .then(res => res.json())
    .then(d => {
      const log = $("#dm-popup-log");
      const msgs = (d && d.messages) || [];
      renderDMLog(log, msgs);
    })
    .catch(err => {
      const log = $("#dm-popup-log");
      if (log) log.innerHTML = `<div class="presence-empty">Could not load messages: ${escapeHtml(err.message || "Unknown error")}</div>`;
    });
}

function closeDMPopup() {
  const modal = $("#dm-popup-modal");
  if (modal) modal.classList.add("hidden");
  state.presenceSelectedUserId = null;
}

function bindDMPopup() {
  const modal = $("#dm-popup-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  modal.querySelectorAll("[data-dm-popup-dismiss]").forEach(el => {
    el.addEventListener("click", closeDMPopup);
  });

  $("#dm-popup-back")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeDMPopup();
    openMessagesPopup();
  });

  $("#dm-popup-clear")?.addEventListener("click", () => {
    const uid = state.presenceSelectedUserId;
    if (!uid) return;
    if (!confirm("Clear this conversation history?")) return;
    clearPresenceConversation(uid, () => {
      $("#dm-popup-log").innerHTML = '<div class="presence-empty">Conversation cleared.</div>';
    });
  });

  $("#dm-popup-send")?.addEventListener("click", () => sendDMPopupMessage());
  $("#dm-popup-text")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendDMPopupMessage();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeDMPopup();
    }
  });
}

function sendDMPopupMessage() {
  const uid = state.presenceSelectedUserId;
  const textEl = $("#dm-popup-text");
  if (!uid || !textEl) return;
  const text = (textEl.value || "").trim();
  if (!text) return;

  presenceFetch("/api/presence/dm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: uid, text }),
  }).then(res => {
    if (!res.ok) throw new Error("Failed to send");
    textEl.value = "";
    // Refresh the log
    presenceFetch(`/api/presence/dm?with=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(d => {
        const log = $("#dm-popup-log");
        if (log) renderDMLog(log, (d && d.messages) || []);
      })
      .catch(() => {});
    // Update badge
    fetchPresenceSnapshot().then(s => {
      state.presenceData = s;
      updatePresenceTileBadge();
    }).catch(() => {});
  }).catch(err => {
    showToast(`Could not send message: ${err.message}`, true);
  });
}

/* ==================== Messages Inbox Popup ==================== */

function openMessagesPopup() {
  const modal = $("#messages-popup-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  renderMessagesPopupList();
}

function closeMessagesPopup() {
  const modal = $("#messages-popup-modal");
  if (modal) modal.classList.add("hidden");
}

function renderMessagesPopupList() {
  const list = $("#messages-popup-list");
  if (!list) return;
  const snap = state.presenceData || {};
  const recentDms = Array.isArray(snap.myRecentDms) ? snap.myRecentDms : [];

  if (!recentDms.length) {
    list.innerHTML = '<div class="search-popup-results-empty">No messages yet.</div>';
    return;
  }

  list.innerHTML = "";
  const meId = String(state.currentUserId || "");

  // Group by other user
  const byOther = new Map();
  recentDms.forEach(m => {
    const otherId = String(m.from) === meId ? String(m.to) : String(m.from);
    if (!byOther.has(otherId) || new Date(m.ts) > new Date(byOther.get(otherId).ts)) {
      byOther.set(otherId, m);
    }
  });

  byOther.forEach((m, otherId) => {
    const row = document.createElement("div");
    row.className = "presence-recent-row";

    // Find display name
    const users = Array.isArray(snap.users) ? snap.users : [];
    const userEntry = users.find(u => String(u.id) === otherId);
    const disp = userEntry ? (userEntry.displayName || userEntry.id) : otherId;

    const rawTxt = String(m.text || "");
    const short = rawTxt.length > 48 ? rawTxt.slice(0, 48) + "…" : rawTxt;

    const otherLastRead = presenceLastRead[otherId] || (snap.lastReadDms && snap.lastReadDms[otherId] ? new Date(snap.lastReadDms[otherId]).getTime() : 0);
    const msgTsNum = new Date(m.ts).getTime();
    const isIncomingLatest = String(m.from) !== meId;
    let isUnread = isIncomingLatest && msgTsNum > otherLastRead;

    if (isUnread) row.classList.add("unread");
    else row.classList.add("read");

    const who = document.createElement("span");
    who.className = "presence-recent-who";
    who.textContent = disp;

    const snip = document.createElement("span");
    snip.className = "presence-recent-snip";
    snip.textContent = (String(m.from) === meId ? "you: " : "") + short;

    const tm = document.createElement("span");
    tm.className = "presence-recent-time";
    tm.textContent = m.ts ? formatTimeAgo(m.ts) : "";

    row.append(who, snip, tm);
    row.addEventListener("click", () => {
      closeMessagesPopup();
      switchToPresenceMessagesTab();
      openDMInline(otherId, disp);
    });
    list.appendChild(row);
  });
}

function bindMessagesPopup() {
  const modal = $("#messages-popup-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  modal.querySelectorAll("[data-messages-popup-dismiss]").forEach(el => {
    el.addEventListener("click", closeMessagesPopup);
  });

  $("#messages-popup-popout")?.addEventListener("click", () => {
    closeMessagesPopup();
    const dmModal = $("#dm-popup-modal");
    if (dmModal) {
      dmModal.classList.add("dm-popup-large");
      dmModal.classList.remove("hidden");
      $("#dm-popup-title").textContent = "Messages";
      $("#dm-popup-log").innerHTML = '<div class="presence-loading">Loading…</div>';
      // Load all recent DMs into the log
      const snap = state.presenceData || {};
      const recentDms = Array.isArray(snap.myRecentDms) ? snap.myRecentDms : [];
      if (recentDms.length) {
        renderDMLog($("#dm-popup-log"), recentDms);
      } else {
        $("#dm-popup-log").innerHTML = '<div class="presence-empty">No messages yet.</div>';
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeMessagesPopup();
    }
  });
}

// Expose a tiny helper so other code (e.g. after a successful login) can kick the feature
window.__ensurePresenceOnLogin = ensurePresenceOnLogin;

/* ==================== CRM Mail Inbox (large popup with list, pagination, actions, quick link) ==================== */
let mailState = {
  accounts: [],
  currentAccountId: '',
  messages: [],
  pages: {},           // cache: { 1: {items, nextCursor, prevCursor}, ... }
  page: 1,
  pageSize: 50,
  search: '',
  selected: new Set(),
};

// Dashboard-side read/unread overrides for the mail inbox list.
// Used because the CRM /mail/messages/markread endpoint currently returns HTML error pages
// (instead of JSON) for this tenant/setup, so we cannot reliably push marks server-side yet.
// Per user: even if it can't sync to native mail module, the dashboard list + indicator must
// remember marks persistently (across modal close/reopen and page reloads) until user bulk-marks
// in the native CRM mail UI later.
// Stored in localStorage (portal-keyed) so it survives reloads; also lives in-memory for the session.
let mailDashboardReadIds = new Set();

function loadMailDashboardReadIds() {
  try {
    const portal = (state && state.portalUrl) || localStorage.getItem('oo_portal_url') || 'default';
    const key = `oo_mail_read_ids_${portal}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(id => mailDashboardReadIds.add(String(id)));
    }
  } catch (e) { /* non-fatal */ }
}

function saveMailDashboardReadIds() {
  try {
    const portal = (state && state.portalUrl) || localStorage.getItem('oo_portal_url') || 'default';
    const key = `oo_mail_read_ids_${portal}`;
    localStorage.setItem(key, JSON.stringify(Array.from(mailDashboardReadIds)));
  } catch (e) { /* non-fatal */ }
}


// Tolerant read/unread detector for mail message objects (list summaries or full detail).
// OnlyOffice/Community Server mail responses use wildly inconsistent casing and structures
// (see normalizeMailMessage for the precedent we follow here). The /mail/messages list
// summary often omits a usable flag (or puts it under different keys), which is why the
// inbox was showing everything as unread until we had local overrides. This helper tries
// the common variants + simple inversions + a couple of nested flag bags so that when the
// server *does* provide the status we respect it (and promote it into our dashboard Set
// for persistence across re-fetches / close-reopen).
function getMailMessageIsRead(m) {
  if (!m || typeof m !== 'object') return false;

  // Direct top-level booleans / 0|1 under many casings
  const direct = m.read ?? m.isRead ?? m.Read ?? m.IsRead ?? m.seen ?? m.Seen ?? m.IsSeen;
  if (typeof direct === 'boolean') return direct;
  if (typeof direct === 'number') return direct !== 0;

  // Common inverted flags
  if (typeof m.unread === 'boolean') return !m.unread;
  if (typeof m.Unread === 'boolean') return !m.Unread;
  if (typeof m.new === 'boolean') return !m.new;
  if (typeof m.New === 'boolean') return !m.New;
  if (typeof m.IsNew === 'boolean') return !m.IsNew;

  // Light nesting (flags bag or properties/status)
  const bag = m.flags || m.Flags || m.flag || m.Flag || m.properties || m.Properties || m.status || m.Status;
  if (bag && typeof bag === 'object') {
    const f = bag.read ?? bag.isRead ?? bag.seen ?? bag.Seen ?? bag.readAt ?? bag.ReadAt;
    if (typeof f === 'boolean') return f;
    if (typeof f === 'number') return f !== 0;
    if (typeof bag.unread === 'boolean') return !bag.unread;
    if (typeof bag.Unread === 'boolean') return !bag.Unread;
  }

  return false;
}

function bindMailInboxButton() {
  const btn = $("#mail-inbox-btn");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    openMailInboxModal().catch(err => showToast(err.message || 'Could not open mail inbox', true));
  });
}

function resetQuickLinkSidebar() {
  const ds = $("#mail-deal-search"); if (ds) ds.value = "";
  const dr = $("#mail-deal-results"); if (dr) dr.innerHTML = "";
  if (dr) dr.dataset.selectedDealId = "";
  const lb = $("#mail-link-btn"); if (lb) lb.disabled = true;
  const si = $("#mail-selected-info"); if (si) si.textContent = "";
}

async function openMailInboxModal() {
  const modal = $("#mail-inbox-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  loadMailDashboardReadIds();
  resetQuickLinkSidebar();
  mailState = { accounts: [], messages: [], pageSize: 50, search: '', selected: new Set() };
  $("#mail-search-input").value = "";
  await loadMailMessagesForModal();
  attachMailModalListeners();
}

function attachMailModalListeners() {
  const modal = $("#mail-inbox-modal");
  if (!modal || modal.dataset.listenersBound) return;
  modal.dataset.listenersBound = "1";

  // close
  modal.querySelectorAll("[data-mail-inbox-dismiss]").forEach(el => {
    el.addEventListener("click", () => modal.classList.add("hidden"));
  });

  // search
  const searchIn = $("#mail-search-input");
  let searchT = null;
  if (searchIn) {
    searchIn.addEventListener("input", () => {
      clearTimeout(searchT);
      searchT = setTimeout(() => {
        loadMailMessagesForModal();
      }, 350);
    });
  }

  // select all
  const selAll = $("#mail-select-all");
  if (selAll) {
    selAll.addEventListener("click", () => {
      const cbs = modal.querySelectorAll(".mail-cb");
      const allChecked = Array.from(cbs).every(cb => cb.checked);
      cbs.forEach(cb => {
        cb.checked = !allChecked;
        const id = cb.dataset.id;
        if (cb.checked) mailState.selected.add(id);
        else mailState.selected.delete(id);
      });
      updateMailSelectedInfo();
    });
  }

  // clear selection
  const clearSelBtn = $("#mail-clear-selection");
  if (clearSelBtn) {
    clearSelBtn.addEventListener("click", () => {
      mailState.selected.clear();
      renderMailList(mailState.messages);
      updateMailSelectedInfo();
    });
  }

  // mark read // uses PUT /api/2.0/mail/conversations/mark.json (conversation-level, matching native CRM)
  const markBtn = $("#mail-mark-read");
  if (markBtn) {
    markBtn.addEventListener("click", async () => {
      if (!mailState.selected.size) return;
      const ids = Array.from(mailState.selected);
      const idsStr = ids.map(String);
      try {
        const params = new URLSearchParams();
        ids.forEach(id => params.append('ids[]', id));
        params.append('status', 'read');
        await api('/api/2.0/mail/conversations/mark.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        // Local visual update
        idsStr.forEach(sid => mailDashboardReadIds.add(sid));
        saveMailDashboardReadIds();
        mailState.messages.forEach(m => {
          const mid = String(m.id || m.ID);
          if (idsStr.includes(mid)) m.read = true;
        });
        mailState.selected.clear();
        renderMailList(mailState.messages);
        updateMailSelectedInfo();
        showToast(`Marked ${ids.length} conversation(s) as read`);
      } catch (e) {
        // Fallback: local only
        idsStr.forEach(sid => mailDashboardReadIds.add(sid));
        saveMailDashboardReadIds();
        mailState.messages.forEach(m => {
          const mid = String(m.id || m.ID);
          if (idsStr.includes(mid)) m.read = true;
        });
        mailState.selected.clear();
        renderMailList(mailState.messages);
        updateMailSelectedInfo();
        showToast("Marked as read (local; server push failed: " + String(e.message || e).slice(0, 80) + ")", true);
      }
    });
  }

  // mark unread // uses PUT /api/2.0/mail/conversations/mark.json with status=unread
  const markUnreadBtn = $("#mail-mark-unread");
  if (markUnreadBtn) {
    markUnreadBtn.addEventListener("click", async () => {
      if (!mailState.selected.size) return;
      const ids = Array.from(mailState.selected);
      const idsStr = ids.map(String);
      try {
        const params = new URLSearchParams();
        ids.forEach(id => params.append('ids[]', id));
        params.append('status', 'unread');
        await api('/api/2.0/mail/conversations/mark.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        idsStr.forEach(sid => mailDashboardReadIds.delete(sid));
        saveMailDashboardReadIds();
        mailState.messages.forEach(m => {
          const mid = String(m.id || m.ID);
          if (idsStr.includes(mid)) m.read = false;
        });
        mailState.selected.clear();
        renderMailList(mailState.messages);
        updateMailSelectedInfo();
        showToast(`Marked ${ids.length} conversation(s) as unread`);
      } catch (e) {
        // Fallback: local only
        idsStr.forEach(sid => mailDashboardReadIds.delete(sid));
        saveMailDashboardReadIds();
        mailState.messages.forEach(m => {
          const mid = String(m.id || m.ID);
          if (idsStr.includes(mid)) m.read = false;
        });
        mailState.selected.clear();
        renderMailList(mailState.messages);
        updateMailSelectedInfo();
        showToast("Marked as unread (local; server push failed: " + String(e.message || e).slice(0, 80) + ")", true);
      }
    });
  }

  // delete // uses PUT /api/2.0/mail/conversations/move.json with folder=4 (trash)
  const delBtn = $("#mail-delete");
  if (delBtn) {
    delBtn.addEventListener("click", async () => {
      if (!mailState.selected.size) return;
      if (!confirm(`Delete ${mailState.selected.size} conversation(s)?`)) return;
      try {
        const ids = Array.from(mailState.selected);
        const params = new URLSearchParams();
        ids.forEach(id => params.append('ids[]', id));
        params.append('folder', '4');
        await api('/api/2.0/mail/conversations/move.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        showToast(`Deleted ${ids.length} conversation(s)`);
        mailState.selected.clear();
        await loadMailMessagesForModal();
      } catch (e) {
        showToast("Delete failed: " + (e.message || e), true);
      }
    });
  }

  // mark all loaded as read
  const markAllBtn = $("#mail-mark-all-read");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      const ids = mailState.messages.map(m => String(m.id || m.ID)).filter(Boolean);
      if (!ids.length) return;
      try {
        const params = new URLSearchParams();
        ids.forEach(id => params.append('ids[]', id));
        params.append('status', 'read');
        await api('/api/2.0/mail/conversations/mark.json', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        ids.forEach(sid => mailDashboardReadIds.add(sid));
        saveMailDashboardReadIds();
        mailState.messages.forEach(m => { m.read = true; });
        renderMailList(mailState.messages);
        showToast(`Marked all ${ids.length} loaded as read`);
      } catch (e) {
        showToast("Mark all read failed: " + String(e.message || e).slice(0, 60), true);
      }
    });
  }

  // refresh
  const refBtn = $("#mail-refresh");
  if (refBtn) {
    refBtn.addEventListener("click", () => loadMailMessagesForModal());
  }

  // quick link search
  const dealSearch = $("#mail-deal-search");
  let dealT = null;
  if (dealSearch) {
    dealSearch.addEventListener("input", () => {
      clearTimeout(dealT);
      dealT = setTimeout(() => searchDealsForMailLink(dealSearch.value.trim()), 300);
    });
  }

  const linkBtn = $("#mail-link-btn");
  if (linkBtn) {
    linkBtn.addEventListener("click", async () => {
      const results = $("#mail-deal-results");
      const dealId = results && results.dataset.selectedDealId;
      if (!dealId || !mailState.selected.size) return;
      const ids = Array.from(mailState.selected);
      let ok = 0;
      for (const mid of ids) {
        try {
          // Native CRM endpoint: PUT /api/2.0/mail/conversations/crm/link.json
          // form-urlencoded: id_message=<convId>&crm_contact_ids[0][Id]=<dealId>&crm_contact_ids[0][Type]=3
          const params = new URLSearchParams();
          params.append('id_message', String(Number(mid)));
          params.append('crm_contact_ids[0][Id]', String(Number(dealId)));
          params.append('crm_contact_ids[0][Type]', '3');
          await api('/api/2.0/mail/conversations/crm/link.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params.toString()
          });
          ok++;
        } catch (e) {
          const msg = (e.message || e || "").toString().toLowerCase();
          if (msg.includes("duplicate entry") || msg.includes("duplicate") || msg.includes("already linked")) {
            console.warn('[mail-inbox] link: conv', mid, 'already linked to deal', dealId);
            ok++;
          } else {
            console.warn('[mail-inbox] link endpoint failed for conv', mid, e);
          }
        }
      }
      showToast(ok ? `Linked ${ok} email(s) to deal` : "Link failed (see console)");
      // also mark linked as read
      const idsToMark = Array.from(mailState.selected);
      for (const mid of idsToMark) {
        await markMailMessageRead(mid).catch(() => {});
      }
      mailState.selected.clear();
      $("#mail-deal-results").innerHTML = "";
      $("#mail-deal-results").dataset.selectedDealId = "";
      linkBtn.disabled = true;
      $("#mail-selected-info").textContent = "";
      await loadMailMessagesForModal();
    });
  }

  // sidebar toggle
  const toggleBtn = $("#mail-sidebar-toggle");
  const sideBar = $(".mail-right-sidebar", modal);
  if (toggleBtn && sideBar) {
    toggleBtn.addEventListener("click", () => {
      const collapsed = sideBar.classList.toggle("mail-sidebar-collapsed");
      toggleBtn.textContent = collapsed ? "◀" : "▶";
    });
  }
}

async function loadMailAccountsForModal() {
  const sel = $("#mail-account-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">Default / All accounts</option>';
  try {
    const data = await api("/api/2.0/mail/accounts");
    const accts = unwrap(data) || [];
    mailState.accounts = accts;
    const seen = new Set();
    accts.forEach(a => {
      const accId = a.id || a.accountId;
      const emailAddr = a.email || a.name || a.title || accId;
      if (!emailAddr || seen.has(emailAddr)) return;
      seen.add(emailAddr);
      const opt = document.createElement("option");
      opt.value = accId || emailAddr;  // prefer numeric id for accountId param in messages query
      opt.textContent = emailAddr;  // full address
      sel.appendChild(opt);
    });
  } catch (e) {
    // non-fatal
  }
}

async function loadMailMessagesForModal() {
  const list = $("#mail-list");
  if (!list) return;
  list.innerHTML = '<div class="mail-loading">Loading emails…</div>';

  const searchVal = ($("#mail-search-input")?.value || "").trim();
  let q = `folder=1&page_size=50&sort=date&sortorder=descending`;
  if (searchVal) q += `&search=${encodeURIComponent(searchVal)}`;

  try {
    const data = unwrap(await api(`/api/2.0/mail/conversations.json?${q}`));
    const items = Array.isArray(data) ? data : (data?.conversations ?? data?.items ?? []);
    if (items.length) {
      console.debug('[mail-inbox] conversation keys:', Object.keys(items[0]).join(', '));
    }

    // Apply read status
    items.forEach(m => {
      const mid = String(m.id || m.ID);
      if (getMailMessageIsRead(m)) mailDashboardReadIds.add(mid);
      if (mailDashboardReadIds.has(mid)) m.read = true;
    });

    mailState.messages = items;
    renderMailList(items);
    // Update today counter
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = items.filter(m => {
      const d = m.date || m.receivedDate || m.Date;
      return d && new Date(d) >= todayStart;
    }).length;
    const tc = $("#mail-today-count");
    if (tc) tc.textContent = `${todayCount} (Today)`;
  } catch (e) {
    list.innerHTML = `<div class="mail-empty">Could not load mail: ${escapeHtml(e.message || e)}</div>`;
  }
  updateMailSelectedInfo();
}

function renderMailList(msgs) {
  const list = $("#mail-list");
  if (!list) return;
  list.innerHTML = "";
  if (!msgs || !msgs.length) {
    list.innerHTML = '<div class="mail-empty">No emails in this inbox/page.</div>';
    return;
  }

  // header
  const header = document.createElement("div");
  header.className = "mail-row mail-header";
  header.innerHTML = `
    <input type="checkbox" id="mail-cb-all" />
    <div class="mail-from"><strong>From</strong></div>
    <div class="mail-subject"><strong>Subject</strong></div>
    <div class="mail-date"><strong>Date</strong></div>
  `;
  list.appendChild(header);

  const cbAll = header.querySelector("#mail-cb-all");
  if (cbAll) {
    cbAll.checked = msgs.length > 0 && msgs.every(m => mailState.selected.has(String(m.id || m.ID)));
    cbAll.addEventListener("change", () => {
      msgs.forEach(m => {
        const id = String(m.id || m.ID);
        if (cbAll.checked) mailState.selected.add(id);
        else mailState.selected.delete(id);
      });
      renderMailList(msgs); // re-render to sync cbs
      updateMailSelectedInfo();
    });
  }

  msgs.forEach(m => {
    const id = String(m.id || m.ID);
    const from = (typeof m.from === "string" ? m.from : (m.from && (m.from.email || m.from.name)) || m.fromEmail || "").toString();
    const subj = (m.subject || m.Subject || "(no subject)").toString();
    const date = m.date || m.receivedDate || m.Date || "";
    const dateStr = date ? new Date(date).toLocaleDateString() + " " + new Date(date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "";

    const item = document.createElement("div");
    item.className = "mail-item";
    item.dataset.id = id;

    const row = document.createElement("div");
    row.className = "mail-row";
    if (mailState.selected.has(id)) row.classList.add("selected");
    // Use tolerant server read detection (list summary may use read/isRead/seen/IsNew etc or nestings)
    // OR our local dashboard overrides (for marks we performed here + any server-read we promoted).
    // This makes the darker .mail-row-read rows reflect native CRM mail status when the API provides it,
    // while our local Set ensures persistence across modal close/reopen even if a list response drops the flag.
    const isRead = getMailMessageIsRead(m) || mailDashboardReadIds.has(id);
    if (isRead) row.classList.add('mail-row-read');

    row.innerHTML = `
      <input type="checkbox" class="mail-cb" data-id="${escapeHtml(id)}" ${mailState.selected.has(id) ? "checked" : ""} />
      <div class="mail-from" title="${escapeHtml(from)}">${escapeHtml(from).slice(0,28)}</div>
      <div class="mail-subject" title="${escapeHtml(subj)}">${escapeHtml(subj).slice(0,80)}</div>
      <div class="mail-date">${escapeHtml(dateStr)}</div>
    `;

    // Expand button for viewing full email (lazy load, copy from deal preview modal)
    const expBtn = document.createElement("button");
    expBtn.type = "button";
    expBtn.className = "mail-expand-btn";
    expBtn.textContent = "View";
    expBtn.title = "Expand to view full email";
    row.appendChild(expBtn);

    const cb = row.querySelector(".mail-cb");
    cb.addEventListener("click", (e) => {
      e.stopImmediatePropagation();
      if (cb.checked) mailState.selected.add(id);
      else mailState.selected.delete(id);
      if (cb.checked) row.classList.add("selected");
      else row.classList.remove("selected");
      updateMailSelectedInfo();
    });

    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target === expBtn) return;
      // toggle selection on row click
      if (mailState.selected.has(id)) {
        mailState.selected.delete(id);
        row.classList.remove("selected");
        cb.checked = false;
      } else {
        mailState.selected.add(id);
        row.classList.add("selected");
        cb.checked = true;
      }
      updateMailSelectedInfo();
    });

    // Note: attachments display handled inside renderMailEmbedPanel (expanded view)

    const detail = document.createElement("div");
    detail.className = "mail-detail hidden";
    item.appendChild(row);
    item.appendChild(detail);

    expBtn.addEventListener("click", async (e) => {
      e.stopImmediatePropagation();
      const isHidden = detail.classList.contains("hidden");
      detail.classList.toggle("hidden");
      if (!isHidden) return; // was shown, now hiding
      if (item._mailLoaded) return;
      item._mailLoaded = true;
      detail.innerHTML = '<div class="mail-loading">Loading full email…</div>';
      try {
        const fullMail = await fetchMailMessage(id);
        detail.innerHTML = "";
        const embed = document.createElement("div");
        embed.className = "opp-preview-mail-embed";
        detail.appendChild(embed);
        renderMailEmbedPanel(embed, fullMail, id, {
          openUrl: portalMailMessageUrl(id)
        });
        if (getMailMessageIsRead(fullMail)) {
          mailDashboardReadIds.add(id);
          saveMailDashboardReadIds();
        }
        markMailMessageRead(id).catch(() => {});
        row.classList.add('mail-row-read');
      } catch (e) {
        detail.innerHTML = `<div class="mail-empty">Failed to load full email: ${escapeHtml(e.message || e)}</div>`;
      }
    });

    list.appendChild(item);
  });
}

function updateMailSelectedInfo() {
  const n = mailState.selected.size;
  // Enable toolbar action buttons (mark read/unread) for the viewer when items selected.
  // (delete is hidden in viewer-only mode)
  const hasSel = n > 0;
  const markReadBtn = $("#mail-mark-read");
  const markUnreadBtn = $("#mail-mark-unread");
  const delBtn = $("#mail-delete");
  const clearSelBtn = $("#mail-clear-selection");
  if (markReadBtn) markReadBtn.disabled = !hasSel;
  if (markUnreadBtn) markUnreadBtn.disabled = !hasSel;
  if (delBtn) delBtn.disabled = !hasSel;
  if (clearSelBtn) clearSelBtn.disabled = !hasSel;

  const info = $("#mail-selected-info");
  const linkBtn = $("#mail-link-btn");
  if (!info) return;
  info.textContent = n ? `${n} selected` : "";
  if (linkBtn) linkBtn.disabled = n === 0 || !$("#mail-deal-results")?.dataset?.selectedDealId;
}

async function markMailMessageRead(messageId) {
  const id = String(messageId);
  mailDashboardReadIds.add(id);
  saveMailDashboardReadIds();
  if (mailState && mailState.messages) {
    mailState.messages.forEach(m => {
      if (String(m.id || m.ID) === id) m.read = true;
    });
  }
  // Push to server (best-effort, non-blocking)
  try {
    const params = new URLSearchParams();
    params.append('ids[]', id);
    params.append('status', 'read');
    await api('/api/2.0/mail/conversations/mark.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      showCrashBanner: false
    });
  } catch {
    // non-fatal
  }
}

async function searchDealsForMailLink(query) {
  const resEl = $("#mail-deal-results");
  const linkBtn = $("#mail-link-btn");
  if (!resEl) return;
  resEl.innerHTML = "";
  resEl.dataset.selectedDealId = "";
  resEl.dataset.selectedDealTitle = "";
  if (linkBtn) linkBtn.disabled = true;
  const q = (query || "").trim();
  if (q.length < 1) {
    resEl.classList.add("hidden");
    return;
  }
  try {
    const opps = await searchOpportunitiesByTitle(q, { limit: 8 });
    resEl.classList.remove("hidden");
    if (!opps.length) {
      const b = document.createElement("button");
      b.type = "button";
      b.disabled = true;
      b.textContent = "No matches";
      resEl.appendChild(b);
      return;
    }
    opps.forEach(opp => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = opp.title;
      b.addEventListener("click", () => {
        resEl.querySelectorAll("button").forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
        resEl.dataset.selectedDealId = String(opp.id);
        resEl.dataset.selectedDealTitle = opp.title;
        if (linkBtn) linkBtn.disabled = mailState.selected.size === 0;
        updateMailSelectedInfo();
      });
      resEl.appendChild(b);
    });
  } catch (err) {
    showToast("Deal search failed: " + (err.message || err), true);
    resEl.classList.add("hidden");
  }
}

function bindCreateOpportunityModal() {
  const modal = $("#create-opportunity-modal");
  const form = $("#create-opportunity-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitCreateOpportunityForm(e).catch((err) => setCreateOpportunityError(err.message));
  });

  $("#create-opportunity-cancel")?.addEventListener("click", closeCreateOpportunityModal);
  modal.querySelectorAll("[data-create-opp-dismiss]").forEach((el) => {
    el.addEventListener("click", closeCreateOpportunityModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCreateOpportunityModal();
  });

  $("#create-opp-private")?.addEventListener("change", syncCreateOppPrivateFields);

  $("#create-opp-tag-add")?.addEventListener("change", (ev) => {
    const title = ev.target.value;
    const draft = state.newOpportunityDraft;
    if (!title || !draft) return;
    if (!draft.tags.some((t) => tagsEqual(t, title))) {
      draft.tags.push(title);
      renderCreateOppTagChips();
    }
    ev.target.value = "";
  });

  bindCreateOppContactPicker();
}

function setTaskModalError(message) {
  const el = $("#task-modal-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function closeNewTaskModal() {
  const modal = $("#task-modal");
  if (modal) modal.classList.add("hidden");
  setTaskModalError("");
  // Re-eval header marquee now that a popup is closed (may need to show if queued >8s)
  setTimeout(updateMutationSyncStatus, 30);
}

function clearNewTaskOpportunitySelection() {
  state.newTaskOpportunity = { id: null, title: "" };
  const search = $("#new-task-opportunity-search");
  const selected = $("#new-task-opportunity-selected");
  const results = $("#new-task-opportunity-results");
  if (search) search.value = "";
  if (selected) selected.innerHTML = "";
  if (results) {
    results.innerHTML = "";
    results.classList.add("hidden");
  }
}

function setNewTaskOpportunitySelection(id, title) {
  state.newTaskOpportunity = { id: Number(id), title: title || `Opportunity #${id}` };
  const search = $("#new-task-opportunity-search");
  const selected = $("#new-task-opportunity-selected");
  const results = $("#new-task-opportunity-results");
  if (search) search.value = "";
  if (results) {
    results.innerHTML = "";
    results.classList.add("hidden");
  }
  if (selected) {
    selected.innerHTML = `${escapeHtml(state.newTaskOpportunity.title)} <span class="contact-clear" role="button" tabindex="0">clear</span>`;
    $(".contact-clear", selected)?.addEventListener("click", () => clearNewTaskOpportunitySelection());
  }
}

async function loadTaskCategories({ force = false } = {}) {
  // Prefer in-memory cache
  if (state.taskCategories.length && !force) return;

  // Restore from localStorage cache (survives reloads / offline). We only hit the CRM server
  // to (re)validate the list on explicit login (see login paths).
  if (!state.taskCategories.length) {
    try {
      const cached = localStorage.getItem(TASK_CATEGORIES_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          state.taskCategories = parsed;
          if (!force) return;
        }
      }
    } catch {}
  }

  if (!force && state.taskCategories.length) return;

  try {
    const data = await api("/api/2.0/crm/task/category");
    state.taskCategories = unwrap(data);
    try {
      localStorage.setItem(TASK_CATEGORIES_KEY, JSON.stringify(state.taskCategories));
    } catch {}
  } catch {
    if (!state.taskCategories.length) state.taskCategories = [];
  }
}

function populateNewTaskCategorySelect() {
  const sel = $("#new-task-category");
  if (!sel) return;
  sel.innerHTML = "";
  if (!state.taskCategories.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Loading categories…";
    sel.appendChild(opt);
    sel.required = false;
    return;
  }
  sel.required = true;
  for (const cat of state.taskCategories) {
    const opt = document.createElement("option");
    opt.value = String(cat.id ?? cat.ID ?? "");
    opt.textContent = cat.title || cat.Title || `Category ${opt.value}`;
    sel.appendChild(opt);
  }
}

function populateNewTaskResponsibleSelect() {
  const sel = $("#new-task-responsible");
  if (!sel) return;
  sel.innerHTML = "";
  const users = new Map();
  for (const u of state.portalUsers) {
    if (u.id != null) users.set(String(u.id), u.displayName || u.id);
  }
  if (state.currentUserId != null) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }
  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (state.currentUserId != null) sel.value = String(state.currentUserId);
}

async function searchOpportunitiesByTitle(query, { limit = 30 } = {}) {
  const q = String(query || "").trim();
  const local = [];
  const seen = new Set();
  const qLower = q.toLowerCase();

  for (const g of state.groups) {
    for (const o of g.opportunities || []) {
      const id = o.id ?? o.ID;
      if (id == null) continue;
      const title = (o.title || o.Title || `Opportunity #${id}`).trim();
      const key = String(id);
      if (seen.has(key)) continue;
      if (!q || title.toLowerCase().includes(qLower)) {
        seen.add(key);
        local.push({ id: Number(id), title });
      }
    }
  }

  if (q.length >= 2) {
    try {
      const params = new URLSearchParams({ startIndex: "0", count: "40", filterValue: q, stageType: "0" });
      const data = await api(`/api/2.0/crm/opportunity/filter?${params}`);
      for (const o of unwrap(data)) {
        const id = o.id ?? o.ID;
        if (id == null) continue;
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        local.push({ id: Number(id), title: (o.title || o.Title || `Opportunity #${id}`).trim() });
        indexOpportunity(o);
      }
    } catch {
      /* use local matches only */
    }
  }

  return local.sort((a, b) => a.title.localeCompare(b.title)).slice(0, limit);
}

async function searchOpportunitiesForTaskPicker(query) {
  return searchOpportunitiesByTitle(query);
}

const ICON_EXTERNAL_LINK = `<svg class="crm-open-external-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

const OPP_PREVIEW_HISTORY_PAGE = 50;
const OPP_PREVIEW_HISTORY_MAX = 500;
const oppPreviewMailCache = new Map();
/** @type {{ oppId: number | null, opp: object | null, group: object | null }} */
let oppPreviewContext = { oppId: null, opp: null, group: null };

/* Search popup state */
const MAX_SEARCH_PREVIEW_TABS = 5;
let searchPopupPreviewTabs = new Map(); // oppId -> { title, data, container, button }

function createCrmOpenLink(oppId, { className = "crm-open-external", title = "Open in CRM" } = {}) {
  const a = document.createElement("a");
  a.href = crmOpportunityUrl(oppId);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = className;
  a.title = title;
  a.setAttribute("aria-label", title);
  a.innerHTML = ICON_EXTERNAL_LINK;
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}

function historyEventDate(ev) {
  return (
    ev.createdOn?.value ??
    ev.createdOn ??
    ev.CreatedOn?.value ??
    ev.CreatedOn ??
    ev.created?.value ??
    ev.created ??
    ev.Created?.value ??
    ev.Created ??
    ev.createOn?.value ??
    ev.createOn ??
    ev.CreateOn?.value ??
    ev.CreateOn ??
    ev.date?.value ??
    ev.date ??
    ev.Date?.value ??
    ev.Date ??
    null
  );
}

function historyEventCategoryId(ev) {
  const cat = ev.category ?? ev.Category;
  if (cat == null || cat === "") return null;
  if (typeof cat === "number" && Number.isFinite(cat)) return Math.floor(cat);
  if (typeof cat === "string" && /^\d+$/.test(cat.trim())) return Number(cat.trim());
  const id = cat?.id ?? cat?.ID ?? cat?.categoryId ?? cat?.CategoryId;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null;
}

function historyEventCategoryLabel(ev) {
  const cat = ev.category ?? ev.Category;
  if (typeof cat === "string" && cat.trim()) return cat.trim();
  const direct = String(cat?.title || cat?.Title || "").trim();
  if (direct) return direct;

  const catId = historyEventCategoryId(ev);
  if (catId != null && state.historyCategories?.length) {
    const found = state.historyCategories.find((c) => Number(c.id ?? c.ID) === catId);
    const title = String(found?.title || found?.Title || "").trim();
    if (title) return title;
  }
  return "";
}

const HISTORY_ICON_MAIL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
const HISTORY_ICON_PHONE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
const HISTORY_ICON_SMS = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`;
const HISTORY_ICON_NOTE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>`;
const HISTORY_ICON_MEETING = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;
const HISTORY_ICON_DEFAULT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

function historyCategoryIconHtml(ev) {
  const cat = historyEventCategoryLabel(ev).toLowerCase();
  if (/\b(mail|email)\b/.test(cat)) return HISTORY_ICON_MAIL;
  if (/\b(phone|call|voicemail)\b/.test(cat)) return HISTORY_ICON_PHONE;
  if (/\b(text|sms)\b/.test(cat) || /\btext message\b/.test(cat)) return HISTORY_ICON_SMS;
  if (/\b(meeting|appointment)\b/.test(cat)) return HISTORY_ICON_MEETING;
  if (/\b(note|comment|event)\b/.test(cat)) return HISTORY_ICON_NOTE;
  return HISTORY_ICON_DEFAULT;
}

function unescapeLooseJsonString(s) {
  return String(s || "")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .trim();
}

function subjectFromPlainMailContent(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const jsonSubj = s.match(/"subject"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (jsonSubj) return unescapeLooseJsonString(jsonSubj[1]);
  const received = s.match(/the email \["([^"]+)"\]/i);
  if (received) return received[1].trim();
  const firstLine = s.split(/\n/).map((l) => l.trim()).find(Boolean) || s;
  const reMatch = firstLine.match(/^re:\s*(.+)$/i);
  if (reMatch) {
    const subj = reMatch[1].trim();
    const dash = subj.match(/^(.+?)\s*[—–-]\s+/);
    return (dash ? dash[1] : subj).trim();
  }
  return "";
}

function subjectFromEmailHtml(raw) {
  const s = String(raw || "").trim();
  if (!s || !historyContentLooksLikeHtml(s)) return "";
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const title = doc.querySelector("title")?.textContent?.trim();
    if (title && title.length > 1 && title.length < 500) return title;
  } catch {
    /* ignore */
  }
  return subjectFromPlainMailContent(htmlToPlainText(s));
}

function historyEventMailSubject(ev, mailPayload) {
  if (mailPayload?.subject) return mailPayload.subject;
  const payload = mailPayload ?? parseHistoryMailPayload(ev);
  if (payload?.subject) return payload.subject;
  const raw = historyEventRawContent(ev);
  const fromPlain = subjectFromPlainMailContent(raw);
  if (fromPlain) return fromPlain;
  const fromHtml = subjectFromEmailHtml(raw);
  if (fromHtml) return fromHtml;
  return "";
}

function historyContentLooksLikeMailNote(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  if (/"message_id"\s*:/i.test(s) || /action=mailmessage/i.test(s)) return true;
  if (/the email \["[^"]+"\]\s+has been received/i.test(s)) return true;
  if (/^re:\s/im.test(s) && s.length < 4000) return true;
  return false;
}

function isHistoryMailEvent(ev, mailPayload = null) {
  const payload = mailPayload ?? parseHistoryMailPayload(ev);
  if (payload) return true;
  if (isMailCategoryEvent(ev)) return true;
  if (extractMailMessageIdsFromFields(ev).length) return true;
  if (historyContentLooksLikeMailNote(historyEventRawContent(ev))) return true;
  return false;
}

function crmMailReceivedLine(subject) {
  const subj = String(subject || "").trim();
  if (!subj) return "An email has been received.";
  return `The email ["${subj}"] has been received.`;
}

function historyEventAuthor(ev) {
  const createBy = ev.createBy || ev.CreateBy || ev.createdBy || ev.CreatedBy;
  return String(
    createBy?.displayName ||
      createBy?.DisplayName ||
      createBy?.userName ||
      createBy?.UserName ||
      ""
  ).trim();
}

function historyEventPlainContent(ev) {
  return toPlainDisplayText(ev.content || ev.Content || ev.description || ev.Description || "", 12000);
}

function historyEventRawContent(ev) {
  return String(ev.content ?? ev.Content ?? ev.description ?? ev.Description ?? "");
}

function historyContentLooksLikeHtml(s) {
  return /<[a-z][\s\S]*>/i.test(String(s || ""));
}

function portalAbsoluteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = state.portalUrl.replace(/\/$/, "");
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
}

function portalFileDownloadUrl(fileId) {
  const id = String(fileId || "").trim();
  if (!id) return "";
  const base = state.portalUrl.replace(/\/$/, "");
  return `${base}/Products/Files/HttpHandlers/filehandler.ashx?action=download&fileid=${encodeURIComponent(id)}`;
}

function portalMailMessageUrl(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return "";
  const base = state.portalUrl.replace(/\/$/, "");
  // Use conversation view and addons path for compatibility (avoids runtime errors on some portals)
  return `${base}/addons/mail/Default.aspx#conversation/${id}`;
}

function sanitizeHistoryHtml(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  wrap.querySelectorAll("script, style, iframe, object, embed, link, meta, base").forEach((el) => el.remove());
  wrap.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      const href = el.getAttribute("href");
      if (href) {
        el.setAttribute("href", portalAbsoluteUrl(href));
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    // sanitize white/light backgrounds from email HTML so it sits on dark mode
    if (el.hasAttribute("style")) {
      let style = el.getAttribute("style");
      // remove any background or bg-color, including white/light variants and !important
      style = style.replace(/background(-color)?\s*:\s*[^;]*(white|#fff|#ffffff|rgb\(255\s*,\s*255\s*,\s*255\)|rgba\(255\s*,\s*255\s*,\s*255[^)]*\))[^;]*;?/gi, "");
      style = style.replace(/background\s*:\s*[^;]*(white|#fff|#ffffff)[^;]*;?/gi, "");
      if (style.trim()) {
        el.setAttribute("style", style);
      } else {
        el.removeAttribute("style");
      }
    }
    el.removeAttribute('bgcolor');
    el.removeAttribute('background');
  });
  return wrap.innerHTML;
}

function collectNumericIdsFromValue(value, out) {
  if (value == null) return;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    out.add(Math.floor(value));
    return;
  }
  const s = String(value).trim();
  if (!s) return;
  if (/^\d+$/.test(s)) {
    out.add(Number(s));
    return;
  }
  const re =
    /(?:mail\/messages\/|messageId[=:]|message_id[=:]|#message\/|action=mailmessage(?:&amp;|&)?message_id=|idmessage[=:]|mailmessageid[=:])(\d+)/gi;
  let m;
  while ((m = re.exec(s))) out.add(Number(m[1]));
}

function extractJsonObjectSubstring(s) {
  const text = String(s || "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseJsonObject(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      /* try embedded object */
    }
  }
  const embedded = extractJsonObjectSubstring(s);
  if (embedded) {
    try {
      const parsed = JSON.parse(embedded);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseLooseMailMetadataFromText(text) {
  const s = String(text || "");
  if (!s) return null;

  let messageId = null;
  const idPatterns = [
    /"message_id"\s*:\s*"?(\d+)"?/i,
    /"messageId"\s*:\s*"?(\d+)"?/i,
    /"mailMessageId"\s*:\s*"?(\d+)"?/i,
    /message_id\s*[=:]\s*"?(\d+)"?/i,
    /action=mailmessage(?:&amp;|&)?message_id=(\d+)/i,
    /#message\/(\d+)/i,
    /mail\/messages\/(\d+)/i,
  ];
  for (const re of idPatterns) {
    const m = s.match(re);
    if (m) {
      messageId = Number(m[1]);
      break;
    }
  }
  if (!Number.isFinite(messageId) || messageId <= 0) return null;

  let subject = "";
  const subjMatch = s.match(/"subject"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (subjMatch) subject = unescapeLooseJsonString(subjMatch[1]);

  return {
    message_id: messageId,
    subject,
  };
}

function collectMailIdsFromObject(value, out, depth = 0, seen = null) {
  if (depth > 10 || value == null) return;
  const visited = seen || new WeakSet();
  if (typeof value === "object") {
    if (visited.has(value)) return;
    visited.add(value);
  }

  if (typeof value === "string") {
    collectNumericIdsFromValue(value, out);
    const loose = parseLooseMailMetadataFromText(value);
    if (loose?.message_id) out.add(loose.message_id);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectMailIdsFromObject(item, out, depth + 1, visited);
    return;
  }

  if (typeof value !== "object") return;

  for (const v of Object.values(value)) {
    collectMailIdsFromObject(v, out, depth + 1, visited);
  }
}

function mailObjectFromEvent(ev) {
  for (const key of [
    "mailMessage",
    "MailMessage",
    "mail",
    "Mail",
    "email",
    "Email",
    "message",
    "Message",
  ]) {
    const m = ev[key];
    if (m && typeof m === "object" && !Array.isArray(m)) return m;
  }
  return null;
}

function normalizeCrmMailPayload(obj) {
  if (!obj || typeof obj !== "object") return null;
  const midRaw = obj.message_id ?? obj.messageId ?? obj.MessageId ?? obj.mailMessageId ?? obj.id ?? obj.ID;
  const messageId = Number(typeof midRaw === "string" ? midRaw.trim() : midRaw);
  if (!Number.isFinite(messageId) || messageId <= 0) return null;

  const fromRaw = String(obj.from ?? obj.From ?? "").trim();
  const from = fromRaw.replace(/^["']+|["']+$/g, "").trim();
  const messageUrl = portalAbsoluteUrl(obj.message_url ?? obj.messageUrl ?? obj.MessageUrl ?? "");

  return {
    messageId,
    from,
    to: String(obj.to ?? obj.To ?? "").trim(),
    cc: String(obj.cc ?? obj.Cc ?? "").trim(),
    bcc: String(obj.bcc ?? obj.Bcc ?? "").trim(),
    subject: String(obj.subject ?? obj.Subject ?? "").trim(),
    date: String(
      obj.date_created ?? obj.dateCreated ?? obj.DateCreated ?? obj.date_sent ?? obj.dateSent ?? ""
    ).trim(),
    introduction: String(
      obj.introduction ?? obj.Introduction ?? obj.preview ?? obj.Preview ?? obj.textBody ?? ""
    ).trim(),
    messageUrl: messageUrl || portalMailMessageUrl(messageId),
  };
}

function historyMailTextSources(ev) {
  const sources = [];
  const push = (v) => {
    if (v == null || v === "") return;
    if (typeof v === "string") sources.push(v);
    else if (typeof v === "object") {
      try {
        sources.push(JSON.stringify(v));
      } catch {
        /* skip */
      }
    }
  };
  push(historyEventRawContent(ev));
  push(ev.additionalData);
  push(ev.AdditionalData);
  push(ev.text);
  push(ev.Text);
  push(ev.description);
  push(ev.Description);
  const nested = mailObjectFromEvent(ev);
  if (nested) push(nested);
  return sources;
}

function parseHistoryMailPayload(ev) {
  const nested = mailObjectFromEvent(ev);
  if (nested) {
    const fromNested = normalizeCrmMailPayload(nested);
    if (fromNested) return fromNested;
  }

  for (const src of historyMailTextSources(ev)) {
    const payload = normalizeCrmMailPayload(tryParseJsonObject(src));
    if (payload) return payload;
    const loose = parseLooseMailMetadataFromText(src);
    if (loose) {
      const normalized = normalizeCrmMailPayload(loose);
      if (normalized) return normalized;
    }
  }
  return null;
}

function extractMailMessageIdsFromFields(ev) {
  const ids = new Set();
  const payload = parseHistoryMailPayload(ev);
  if (payload?.messageId) ids.add(payload.messageId);

  const fields = [
    ev.messageId,
    ev.MessageId,
    ev.mailMessageId,
    ev.MailMessageId,
    ev.idMessage,
    ev.IdMessage,
  ];
  for (const f of fields) collectNumericIdsFromValue(f, ids);

  let ad = tryParseJsonObject(ev.additionalData ?? ev.AdditionalData) ?? ev.additionalData ?? ev.AdditionalData;
  if (ad && typeof ad === "object") {
    collectNumericIdsFromValue(ad.message_id ?? ad.messageId ?? ad.MessageId ?? ad.mailMessageId, ids);
    collectNumericIdsFromValue(ad.message_url ?? ad.messageUrl ?? ad.MessageUrl, ids);
    collectMailIdsFromObject(ad, ids);
  }

  for (const src of historyMailTextSources(ev)) {
    collectNumericIdsFromValue(src, ids);
    const loose = parseLooseMailMetadataFromText(src);
    if (loose?.message_id) ids.add(loose.message_id);
  }

  const nested = mailObjectFromEvent(ev);
  if (nested) collectMailIdsFromObject(nested, ids);

  return [...ids].filter((id) => Number.isFinite(id) && id > 0);
}

function extractMailMessageIds(ev) {
  const ids = extractMailMessageIdsFromFields(ev);
  if (ids.length) return ids;
  const raw = historyEventRawContent(ev);
  if (isMailCategoryEvent(ev) || shouldCollapseHistoryNoteContent(ev, raw)) {
    const fromContent = new Set();
    collectNumericIdsFromValue(raw, fromContent);
    return [...fromContent];
  }
  return [];
}

function isMailCategoryEvent(ev) {
  const cat = historyEventCategoryLabel(ev).toLowerCase();
  return /\b(mail|email)\b/.test(cat);
}

function isNoteCategoryEvent(ev) {
  const cat = historyEventCategoryLabel(ev).toLowerCase();
  // Common note-style categories from the Event note UI in quick/deal modals.
  // If the category is a note activity, treat rich text as intentional formatting, not email.
  return /\b(note|comment|activity|meeting|call|task)\b/.test(cat);
}

function historyContentLooksLikeEmailDump(raw) {
  const s = String(raw || "");
  if (!s.trim()) return false;
  if (/<!DOCTYPE|<html[\s>]/i.test(s)) return true;
  if (NOTIFY_TEMPLATE_MARKERS.some((re) => re.test(s))) return true;
  if (/MIME-Version:|Content-Type:\s*text\/html|multipart\/alternative/i.test(s)) return true;
  if (/mso-|MsoNormal|urn:schemas-microsoft|xmlns:v=|xmlns:o=|<o:p>|<v:shape/i.test(s)) return true;
  if (s.length > 900 && /<table[\s>]/i.test(s)) return true;
  if (s.length > 500 && (s.match(/<style[\s>]/gi) || []).length >= 1) return true;
  if (s.length > 400 && (s.match(/style="/gi) || []).length >= 4) return true;
  return false;
}

function shouldCollapseHistoryNoteContent(ev, raw) {
  const content = String(raw || "").trim();
  if (!content) return false;
  if (parseHistoryMailPayload(ev)) return true;
  if (extractMailMessageIdsFromFields(ev).length) return true;
  if (isMailCategoryEvent(ev)) return true;
  if (historyContentLooksLikeEmailDump(content)) return true;
  if (isNoteCategoryEvent(ev)) return false;

  if (historyContentLooksLikeHtml(content) && content.length > 500 && (isMailCategoryEvent(ev) || historyContentLooksLikeEmailDump(content))) return true;

  return false;
}

function isMailLinkedHistoryEvent(ev) {
  return shouldCollapseHistoryNoteContent(ev, historyEventRawContent(ev));
}

function htmlToPlainText(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  if (!historyContentLooksLikeHtml(s)) return s;
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const text = doc.body?.textContent || "";
    return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return toPlainDisplayText(s, 50000);
  }
}

function attachmentDedupeKey(file) {
  return String(file.url || file.id || file.title || "");
}

function extractHistoryAttachments(ev) {
  const seen = new Set();
  const out = [];

  const push = (raw) => {
    if (!raw) return;
    if (typeof raw === "string") {
      const idMatch = raw.match(/fileid=([^&"'\s]+)/i);
      if (idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const file = { id, title: id, url: portalFileDownloadUrl(id) };
        const key = attachmentDedupeKey(file);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(file);
        }
      }
      return;
    }
    if (typeof raw !== "object") return;

    const id = raw.id ?? raw.ID ?? raw.fileId ?? raw.FileId ?? raw.documentId ?? raw.DocumentId;
    const title =
      raw.title ||
      raw.Title ||
      raw.fileName ||
      raw.FileName ||
      raw.name ||
      raw.Name ||
      raw.displayName ||
      raw.DisplayName ||
      (id ? `File ${id}` : "");
    let url =
      raw.viewUrl ||
      raw.ViewUrl ||
      raw.downloadUrl ||
      raw.DownloadUrl ||
      raw.url ||
      raw.Url ||
      raw.link ||
      raw.Link;
    if (!url && id) url = portalFileDownloadUrl(id);
    if (!url && !title) return;
    const file = {
      id: id != null ? String(id) : "",
      title: String(title || "Attachment").trim(),
      url: url ? portalAbsoluteUrl(url) : "",
    };
    const key = attachmentDedupeKey(file);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  const lists = [
    ev.files,
    ev.Files,
    ev.attachments,
    ev.Attachments,
    ev.documents,
    ev.Documents,
    ev.fileList,
    ev.FileList,
  ];
  for (const list of lists) {
    if (Array.isArray(list)) list.forEach(push);
  }

  for (const key of ["fileIds", "FileIds", "filesId", "FilesId"]) {
    const ids = ev[key];
    if (Array.isArray(ids)) ids.forEach((id) => push({ id, title: `File ${id}` }));
  }

  let ad = ev.additionalData ?? ev.AdditionalData;
  if (typeof ad === "string") {
    try {
      ad = JSON.parse(ad);
    } catch {
      ad = null;
    }
  }
  if (ad && typeof ad === "object") {
    for (const list of [ad.files, ad.Files, ad.attachments, ad.Attachments]) {
      if (Array.isArray(list)) list.forEach(push);
    }
  }

  const html = historyEventRawContent(ev);
  if (historyContentLooksLikeHtml(html)) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    wrap.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/filehandler\.ashx|\/files\//i.test(href) || /fileid=/i.test(href)) {
        const label = (a.textContent || "").trim() || href.split("/").pop() || "Attachment";
        push({ title: label, url: portalAbsoluteUrl(href) });
      }
    });
  }

  return out;
}

function extractEmailBodyHtml(html) {
  let s = String(html || "").trim();
  if (!s) return "";
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  let bodyHtml = s;
  try {
    const doc = new DOMParser().parseFromString(s, "text/html");
    const body = doc.body;
    if (body) {
      body.querySelectorAll("script, style, meta, link, title, head").forEach((el) => el.remove());
      body.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("style");
        el.removeAttribute("class");
        el.removeAttribute("id");
        for (const attr of [...el.attributes]) {
          if (attr.name.startsWith("data-") || attr.name.startsWith("on")) el.removeAttribute(attr.name);
        }
      });
      bodyHtml = body.innerHTML;
    }
  } catch {
    /* use raw */
  }

  return sanitizeHistoryHtml(bodyHtml);
}

function renderCrmMailPayloadDetail(parent, payload) {
  const rows = [];
  const push = (label, value) => {
    const v = String(value || "").trim();
    if (v) rows.push({ label, value: v });
  };
  push("From", payload.from);
  push("To", payload.to);
  push("Cc", payload.cc);
  push("Subject", payload.subject);
  push("Date", payload.date);

  if (rows.length) renderPreviewFieldGrid(parent, rows);

  if (payload.introduction) {
    const pre = document.createElement("pre");
    pre.className = "opp-preview-mail-text";
    pre.textContent = payload.introduction;
    parent.appendChild(pre);
  }

  const foot = document.createElement("div");
  foot.className = "opp-preview-mail-foot";
  const open = document.createElement("a");
  open.href = payload.messageUrl;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open in Mail";
  foot.appendChild(open);
  parent.appendChild(foot);
}

function pickMailBodyForDisplay(norm, { allowIntroFallback = false, crmPayload = null } = {}) {
  const text = String(norm.textBody || "")
    .replace(/\r\n/g, "\n")
    .trim();
  const html = String(norm.htmlBody || "").trim();

  if (html.length > 40) {
    const cleaned = extractEmailBodyHtml(html);
    if (cleaned.length > 20) return { mode: "html", content: cleaned };
  }

  const plainFromHtml = html ? htmlToPlainText(extractEmailBodyHtml(html) || html) : "";
  const plainFromText = text.includes("<") ? htmlToPlainText(text) : text;

  if (html && plainFromHtml.length > Math.max(plainFromText.length, 80)) {
    return { mode: "html", content: extractEmailBodyHtml(html) };
  }

  const candidates = [plainFromText, plainFromHtml].filter((s) => s && s.length > 2);
  if (allowIntroFallback && crmPayload?.introduction) {
    candidates.push(crmPayload.introduction);
  }

  let best = "";
  for (const c of candidates) {
    if (c.length > best.length && !isNotifyTemplateSpam(c.slice(0, 1200))) best = c;
  }
  if (!best && candidates.length) best = candidates[0];

  if (best.length) return { mode: "text", content: best };
  return { mode: "empty", content: "" };
}

function mailBodyIframeSrcdoc(htmlContent) {
  const body = sanitizeHistoryHtml(htmlContent);
  // sanitize out white/light backgrounds from email HTML so content uses the dark theme bg
  const temp = document.createElement('div');
  temp.innerHTML = body;
  temp.querySelectorAll('*').forEach(el => {
    if (el.hasAttribute('style')) {
      let s = el.getAttribute('style');
      s = s.replace(/background(-color)?\s*:\s*[^;]*(white|#fff|#ffffff|rgb\(255,?\s*255,?\s*255\)|rgba\(255,?\s*255,?\s*255[^)]*\))[^;]*;?/gi, '');
      if (s.trim()) el.setAttribute('style', s); else el.removeAttribute('style');
    }
  });
  const cleaned = temp.innerHTML;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>
body{margin:0.65rem;font:13px/1.45 system-ui,-apple-system,sans-serif;background:#181b24 !important;color:#ccc !important;line-height:1.45;word-break:break-word;}
a{color:#7eb8ff;}img{max-width:100%;height:auto;}table{max-width:100%;}
p{margin:0 0 0.5rem;}blockquote{margin:0.5rem 0;padding-left:0.75rem;border-left:2px solid #3d4659;color:#b8c0d4;}
</style></head><body>${cleaned}</body></html>`;
}

function historyEventDateIso(ev) {
  const raw = historyEventDate(ev);
  if (raw == null || raw === "") return "";
  return parseFeedDate(crmDateTimeFromApi(raw) || raw) || "";
}

function formatHistoryEventDateTime(ev) {
  const raw = historyEventDate(ev);
  if (raw == null || raw === "") return "";
  const iso = parseFeedDate(crmDateTimeFromApi(raw) || raw);
  if (!iso) return String(raw).trim();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(raw).trim();
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

function renderHistoryEventMeta(metaEl, ev) {
  const cat = historyEventCategoryLabel(ev);
  const author = historyEventAuthor(ev);
  const whenLabel = formatHistoryEventDateTime(ev);
  const iso = historyEventDateIso(ev);

  metaEl.replaceChildren();

  const appendSep = () => {
    const sep = document.createElement("span");
    sep.className = "opp-preview-history-meta-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "·";
    metaEl.appendChild(sep);
  };

  if (cat) {
    const span = document.createElement("span");
    span.className = "opp-preview-history-meta-part";
    span.textContent = cat;
    metaEl.appendChild(span);
  }

  if (author || whenLabel) {
    if (metaEl.childElementCount) appendSep();
    const line = document.createElement("span");
    line.className = "opp-preview-history-meta-author-line";

    if (author) {
      const authorSpan = document.createElement("span");
      authorSpan.className = "opp-preview-history-meta-author";
      authorSpan.textContent = author;
      line.appendChild(authorSpan);
    }

    if (whenLabel) {
      const timeEl = document.createElement("time");
      timeEl.className = "opp-preview-history-meta-when";
      if (iso) timeEl.dateTime = iso;
      timeEl.textContent = whenLabel;
      line.appendChild(timeEl);
    }

    metaEl.appendChild(line);
  }
}

function renderHistoryMailReceivedSummary(container, ev, mailPayload = null) {
  const payload = mailPayload ?? parseHistoryMailPayload(ev);
  container.classList.add("opp-preview-history-body--mail-received");
  const p = document.createElement("p");
  p.className = "opp-preview-mail-summary";
  p.textContent = crmMailReceivedLine(historyEventMailSubject(ev, payload));
  container.replaceChildren(p);
}

function renderHistoryNoteBody(container, ev) {
  const raw = historyEventRawContent(ev).trim();
  const mailPayload = parseHistoryMailPayload(ev);
  const mailIds = extractMailMessageIds(ev);

  if (isHistoryMailEvent(ev, mailPayload) || ((shouldCollapseHistoryNoteContent(ev, raw) && !isNoteCategoryEvent(ev)) && (mailPayload || mailIds.length))) {
    renderHistoryMailReceivedSummary(container, ev, mailPayload);
    return;
  }

  if (!raw) {
    container.textContent = "(No text)";
    return;
  }

  if (shouldCollapseHistoryNoteContent(ev, raw) && !isNoteCategoryEvent(ev)) {
    // Only treat as mail summary if it actually has mail indicators or is a mail category.
    // Regular rich-text event notes (even long HTML with <mark>/<strong> etc.) should continue
    // to the HTML rendering path below so bold/italic/underline/highlight are visible.
    if (isHistoryMailEvent(ev, mailPayload) || mailPayload || mailIds.length) {
      renderHistoryMailReceivedSummary(container, ev, mailPayload);
      return;
    }
  }

  if (historyContentLooksLikeHtml(raw)) {
    const looksLikeMail = (isHistoryMailEvent(ev, mailPayload) || isMailCategoryEvent(ev) || historyContentLooksLikeEmailDump(raw)) && !isNoteCategoryEvent(ev);
    if (looksLikeMail) {
      const plain = htmlToPlainText(raw);
      if (plain.length > 0 && plain.length < raw.length * 0.85) {
        container.classList.add("opp-preview-history-body--plain");
        container.textContent = plain;
        return;
      }
      container.classList.add("opp-preview-history-body--html");
      container.innerHTML = sanitizeHistoryHtml(raw);
      return;
    }
    // Regular quick/deal event note with rich text (bold/italic/underline/<mark> highlight).
    // Always render the HTML so formatting is visible in the preview modal history.
    container.classList.add("opp-preview-history-body--html");
    container.innerHTML = sanitizeHistoryHtml(raw);
    return;
  }
  container.textContent = raw;
}

async function fetchMailMessage(messageId) {
  const id = Number(messageId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid mail message id");
  if (oppPreviewMailCache.has(id)) return oppPreviewMailCache.get(id);

  const paths = [`/api/2.0/mail/messages/${id}`, `/api/2.0/mail/messages/${id}.json`];
  let lastErr;
  for (const path of paths) {
    try {
      const data = await api(path);
      const mail = data?.response ?? data?.result ?? data;
      oppPreviewMailCache.set(id, mail);
      return mail;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Could not load mail message");
}

function normalizeMailMessage(mail) {
  if (!mail || typeof mail !== "object") return null;
  const subject = mail.subject || mail.Subject || "";
  const fromRaw = mail.from || mail.From || mail.fromEmail || mail.FromEmail;
  const from =
    typeof fromRaw === "string"
      ? fromRaw
      : fromRaw?.displayName || fromRaw?.title || fromRaw?.email || fromRaw?.Email || "";
  const htmlBody =
    mail.htmlBody ||
    mail.HtmlBody ||
    mail.bodyHtml ||
    mail.BodyHtml ||
    mail.body?.html ||
    mail.Body?.Html ||
    "";
  const textBody =
    mail.textBody ||
    mail.TextBody ||
    mail.plainText ||
    mail.PlainText ||
    mail.bodyText ||
    mail.BodyText ||
    mail.body?.text ||
    mail.Body?.Text ||
    "";
  const date =
    mail.dateSent?.value ??
    mail.dateSent ??
    mail.DateSent?.value ??
    mail.DateSent ??
    mail.receivedDate?.value ??
    mail.receivedDate;
  const toList = mailAddressesFromMessage(mail).join(", ");
  return { subject, from, toList, htmlBody, textBody, date };
}

function renderMailEmbedPanel(panel, mail, messageId, { crmPayload = null, openUrl = "" } = {}) {
  panel.innerHTML = "";
  const norm = normalizeMailMessage(mail);
  if (!norm) {
    panel.innerHTML = '<p class="opp-preview-mail-error">Could not read mail message.</p>';
    return;
  }

  const head = document.createElement("div");
  head.className = "opp-preview-mail-head";
  const subject = norm.subject || crmPayload?.subject || "";
  const from = norm.from || crmPayload?.from || "";
  const toList = norm.toList || crmPayload?.to || "";
  const date = norm.date || crmPayload?.date || "";
  const lines = [
    subject ? `<strong>${escapeHtml(subject)}</strong>` : "",
    from ? `From: ${escapeHtml(from)}` : "",
    toList ? `To: ${escapeHtml(toList)}` : "",
    date ? escapeHtml(formatPreviewDateTime(date) || date) : "",
  ].filter(Boolean);
  head.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "opp-preview-mail-body";

  const bodyPick = pickMailBodyForDisplay(norm, { allowIntroFallback: false, crmPayload });
  if (bodyPick.mode === "html" && bodyPick.content) {
    const iframe = document.createElement("iframe");
    iframe.className = "opp-preview-mail-iframe";
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.setAttribute("title", "Email body");
    iframe.srcdoc = mailBodyIframeSrcdoc(bodyPick.content);
    iframe.addEventListener("load", () => {
      try {
        const doc = iframe.contentDocument;
        const h = doc?.body?.scrollHeight;
        if (h && h > 80) {
          iframe.style.height = `${Math.min(Math.max(h + 20, 240), 1400)}px`;
        }
      } catch {
        /* ignore */
      }
    });
    bodyWrap.appendChild(iframe);
  } else if (bodyPick.mode === "text" && bodyPick.content) {
    const pre = document.createElement("pre");
    pre.className = "opp-preview-mail-text";
    pre.textContent = bodyPick.content;
    bodyWrap.appendChild(pre);
  } else {
    bodyWrap.innerHTML = '<p class="opp-preview-empty">No readable message body. Open in Mail for the full message.</p>';
  }

  panel.appendChild(head);
  panel.appendChild(bodyWrap);

  // Attachments from the mail object (rendered at bottom, after body)
  const atts = Array.isArray(mail.attachments) ? mail.attachments : [];
  if (atts.length) {
    const attBar = document.createElement("div");
    attBar.className = "mail-attachments-panel";
    const mailUrl = portalMailMessageUrl(messageId) || `${state.portalUrl}/addons/mail/Default.aspx#conversation/${messageId}`;
    attBar.innerHTML = "<strong>Attachments:</strong> ";
    atts.forEach((a) => {
      const fileName = a.fileName || a.title || a.storedFileName || "file";
      const wrap = document.createElement("span");
      wrap.className = "mail-attachment-link";
      wrap.textContent = fileName + " (";
      const openLink = document.createElement("a");
      openLink.href = mailUrl;
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.textContent = "Open in Mail";
      wrap.appendChild(openLink);
      wrap.appendChild(document.createTextNode(")"));
      attBar.appendChild(document.createTextNode(" "));
      attBar.appendChild(wrap);
    });
    panel.appendChild(attBar);
  }

  const foot = document.createElement("div");
  foot.className = "opp-preview-mail-foot";
  const open = document.createElement("a");
  open.href = openUrl || crmPayload?.messageUrl || portalMailMessageUrl(messageId);
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open in Mail";
  foot.appendChild(open);
  panel.appendChild(foot);
}

function renderHistoryAttachmentsAside(parent, attachments) {
  if (!attachments.length) return;
  const aside = document.createElement("aside");
  aside.className = "opp-preview-history-attachments";
  aside.setAttribute("aria-label", "Attachments");
  for (const file of attachments) {
    const a = document.createElement("a");
    a.className = "opp-preview-attachment-link";
    a.href = file.url || portalFileDownloadUrl(file.id);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = file.title;
    a.textContent = file.title;
    aside.appendChild(a);
  }
  parent.appendChild(aside);
}

function renderHistoryEventItem(ev) {
  const li = document.createElement("li");
  li.className = "opp-preview-history-item";

  const mailPayload = parseHistoryMailPayload(ev);
  const mailIds = extractMailMessageIds(ev);
  const messageId = mailIds[0] || mailPayload?.messageId || null;
  const isDeletableNote = isNoteCategoryEvent(ev) && !messageId && !mailPayload && !isHistoryMailEvent(ev, mailPayload);

  const metaRow = document.createElement("div");
  metaRow.className = "opp-preview-history-meta-row";

  const icon = document.createElement("span");
  icon.className = "opp-preview-history-type-icon";
  icon.innerHTML = historyCategoryIconHtml(ev);
  icon.setAttribute("aria-hidden", "true");

  const meta = document.createElement("div");
  meta.className = "opp-preview-history-meta";
  renderHistoryEventMeta(meta, ev);

  metaRow.appendChild(icon);
  metaRow.appendChild(meta);

  if (isDeletableNote) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "opp-preview-history-delete";
    delBtn.textContent = "×";
    delBtn.title = "Delete this note";
    delBtn.setAttribute("aria-label", "Delete this history note");
    delBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const histId = ev.id ?? ev.ID ?? ev.historyId ?? ev.Id ?? null;
      if (histId == null) {
        showToast("Cannot delete: missing event ID", true);
        return;
      }
      const ok = await confirmDialog({
        title: "Delete note?",
        message: "This permanently removes the event note from the CRM history.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      try {
        await api(`/api/2.0/crm/history/${encodeURIComponent(histId)}`, {
          method: "DELETE",
          showCrashBanner: false,
        });
        showToast("Note deleted from history");
        // Refresh the open preview (re-fetches history; keeps side popups if any)
        const pmodal = $("#opp-preview-modal");
        if (pmodal && !pmodal.classList.contains("hidden") && oppPreviewContext && oppPreviewContext.oppId != null) {
          const id = oppPreviewContext.oppId;
          const titleHint = oppPreviewContext.opp ? (oppPreviewContext.opp.title || oppPreviewContext.opp.Title || "") : "";
          openOpportunityPreviewModal(id, titleHint, oppPreviewContext.group || null).catch(() => {});
        }
      } catch (err) {
        showToast("Failed to delete note: " + (err && err.message ? err.message : err), true);
      }
    });
    metaRow.appendChild(delBtn);
  }

  li.appendChild(metaRow);

  const row = document.createElement("div");
  row.className = "opp-preview-history-row";

  const main = document.createElement("div");
  main.className = "opp-preview-history-main";

  const note = document.createElement("div");
  note.className = "opp-preview-history-body";
  renderHistoryNoteBody(note, ev);
  main.appendChild(note);

  let mailToggle = null;
  let mailPanel = null;
  if (messageId) {
    mailToggle = document.createElement("button");
    mailToggle.type = "button";
    mailToggle.className = "opp-preview-mail-toggle";
    mailToggle.textContent = "Show linked email";
    mailPanel = document.createElement("div");
    mailPanel.className = "opp-preview-mail-embed hidden";
    mailPanel.setAttribute("hidden", "");

    mailToggle.addEventListener("click", async () => {
      const open = !mailPanel.hasAttribute("hidden");
      if (open) {
        mailPanel.setAttribute("hidden", "");
        mailPanel.classList.add("hidden");
        mailToggle.textContent = "Show linked email";
        return;
      }
      mailPanel.removeAttribute("hidden");
      mailPanel.classList.remove("hidden");
      mailToggle.textContent = "Hide linked email";

      if (!messageId) {
        mailPanel.innerHTML =
          '<p class="opp-preview-mail-error">No mail message id on this event. Open the deal in CRM to view this email.</p>';
        return;
      }

      if (mailPanel.dataset.loaded === String(messageId)) return;

      mailPanel.innerHTML = '<p class="opp-preview-mail-loading">Loading email…</p>';
      try {
        const mail = await fetchMailMessage(messageId);
        renderMailEmbedPanel(mailPanel, mail, messageId, { crmPayload: mailPayload });
        mailPanel.dataset.loaded = String(messageId);
      } catch (err) {
        const rawMsg = err && err.message ? String(err.message) : "";
        let nice = `Could not load email (${escapeHtml(rawMsg)}).`;
        if (/wasn['']t found|not found|404/i.test(rawMsg)) {
          nice = "Linked email no longer available (deleted or access changed in CRM). Open the deal in CRM to view details.";
        }
        mailPanel.innerHTML = `<p class="opp-preview-mail-error">${nice}</p>`;
        const retry = document.createElement("a");
        retry.href =
          mailPayload?.messageUrl || portalMailMessageUrl(messageId);
        retry.target = "_blank";
        retry.rel = "noopener noreferrer";
        retry.className = "opp-preview-mail-fallback";
        retry.textContent = "Open in Mail";
        mailPanel.appendChild(retry);
      }
    });

    main.appendChild(mailToggle);
    main.appendChild(mailPanel);
  }

  row.appendChild(main);
  renderHistoryAttachmentsAside(row, extractHistoryAttachments(ev));
  li.appendChild(row);
  return li;
}

function formatPreviewDateTime(raw) {
  if (raw == null || raw === "") return "";
  const iso = crmDateTimeFromApi(raw) || raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString();
}

// Date-only formatter for deal due dates (Expected close) so preview matches native CRM display
// (avoids time component and potential TZ off-by-one from datetime parsing on read).
function formatPreviewDueDate(raw) {
  if (raw == null || raw === "") return "";
  const iso = crmDateTimeFromApi(raw) || raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString();
}

function formatResponsibleLabel(opp) {
  const r = opp.responsible || opp.Responsible;
  if (r && typeof r === "object") {
    return (
      r.displayName || r.DisplayName || r.userName || r.UserName || r.title || r.Title || ""
    ).trim();
  }
  const rid = opp.responsibleId ?? opp.responsibleid ?? opp.responsibleID;
  if (rid != null && state.portalUsers.length) {
    const u = state.portalUsers.find((p) => sameUserId(p.id, rid));
    if (u) return u.displayName || String(rid);
  }
  return rid != null ? String(rid) : "";
}

function formatMembersLabel(opp) {
  const members = Array.isArray(opp.members) ? opp.members : Array.isArray(opp.Members) ? opp.Members : [];
  if (!members.length) return "";
  return members
    .map((m) => {
      if (typeof m === "string") return m;
      return (
        m.displayName ||
        m.DisplayName ||
        m.userName ||
        m.UserName ||
        m.title ||
        m.Title ||
        m.id ||
        m.ID ||
        ""
      );
    })
    .filter(Boolean)
    .join(", ");
}

function formatCustomFieldValueForDisplay(def, rawValue) {
  const code = customFieldTypeCode(def);
  if (code === 3) {
    const t = String(rawValue ?? "").trim().toLowerCase();
    if (t === "false" || t === "0" || t === "no" || t === "off" || t === "") return "No";
    return "Yes";
  }
  if (code === 4) return "";
  return formatCustomFieldValueForApi(def, rawValue) || "—";
}

function resolveStageTitle(opp) {
  const sid = resolveOppStageId(opp);
  const stage = state.stages.find((s) => String(s.id ?? s.ID) === String(sid));
  return (opp.stage?.title || opp.stage?.Title || stage?.title || stage?.Title || sid || "").trim();
}

function buildOpportunityPreviewStandardFields(opp, tags) {
  const rows = [];
  const push = (label, value) => {
    const v = value == null ? "" : String(value).trim();
    if (!v) return;
    rows.push({ label, value: v });
  };

  push("Stage", resolveStageTitle(opp));
  push("Contact", getOpportunityContactLabel(opp));
  push("Responsible", formatResponsibleLabel(opp));

  push("Value", formatMoney(opp));
  push("Expected close", formatPreviewDueDate(opportunityDueDateRaw(opp)));
  // Actual close hidden per user request (showActualClose field removed from preview)
  push("Created", formatPreviewDateTime(opp.createOn ?? opp.created ?? opp.Created));
  push("Tags", tags.length ? tags.join(", ") : "");
  if (opp.isPrivate ?? opp.IsPrivate) push("Private", "Yes");
  push("Bid type", opp.bidType ?? opp.BidType);
  return rows;
}

function buildOpportunityPreviewUserFields(opp, customFieldValues) {
  const rows = [];
  const valuesByFieldId = new Map();
  for (const item of customFieldValues) {
    const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
    if (fieldId != null) valuesByFieldId.set(String(fieldId), item);
  }

  const defs = state.customFieldDefs.length ? state.customFieldDefs : [];
  const seen = new Set();

  for (const def of defs) {
    const fieldId = customFieldDefinitionId(def);
    if (fieldId == null) continue;
    if (customFieldTypeCode(def) === 4) continue;
    const key = String(fieldId);
    seen.add(key);
    const item = valuesByFieldId.get(key);
    const raw = item ? readSavedCustomFieldValue(item) : getOppCustomFieldValue(opp, customFieldLabel(def));
    const label = customFieldLabel(def) || `Field ${fieldId}`;
    const value = formatCustomFieldValueForDisplay(def, raw);
    if (!value || value === "—") continue;
    rows.push({ label, value });
  }

  for (const item of customFieldValues) {
    const fieldId = item.id ?? item.ID ?? item.fieldId ?? item.FieldId;
    if (fieldId == null) continue;
    const key = String(fieldId);
    if (seen.has(key)) continue;
    const def = state.customFieldById.get(key);
    if (def && customFieldTypeCode(def) === 4) continue;
    const label = customFieldLabel(item) || customFieldLabel(def) || `Field ${fieldId}`;
    const value = formatCustomFieldValueForDisplay(def, readSavedCustomFieldValue(item));
    if (!value || value === "—") continue;
    rows.push({ label, value });
  }

  return rows;
}

async function fetchAllOpportunityHistory(oppId, force = false) {
  const all = [];
  let startIndex = 0;
  while (all.length < OPP_PREVIEW_HISTORY_MAX) {
    const params = new URLSearchParams({
      startIndex: String(startIndex),
      count: String(OPP_PREVIEW_HISTORY_PAGE),
      entityType: "opportunity",
      entityId: String(oppId),
    });
    const path = `/api/2.0/crm/history/filter?${params}`;
    const data = await api(force ? bustCache(path) : path);
    const page = unwrapHistoryEvents(data);
    if (!page.length) break;
    all.push(...page);
    if (page.length < OPP_PREVIEW_HISTORY_PAGE) break;
    startIndex += page.length;
  }

  all.sort((a, b) => {
    const ta = new Date(historyEventDate(a) || 0).getTime();
    const tb = new Date(historyEventDate(b) || 0).getTime();
    return tb - ta;
  });
  return all.slice(0, OPP_PREVIEW_HISTORY_MAX);
}

async function fetchOpportunityPreviewData(oppId, force = false) {
  const id = Number(oppId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid opportunity id");

  await Promise.all([
    state.stages.length ? Promise.resolve() : loadStages(),
    state.customFieldDefs.length ? Promise.resolve() : loadOpportunityCustomFieldDefs(),
    state.portalUsers.length ? Promise.resolve() : loadPortalUsers(),
    loadHistoryCategories(),
  ]);

  const opp = await fetchOpportunityForUpdate(id, force);
  const [customFieldValues, history, tags, documents] = await Promise.all([
    fetchOpportunityCustomFieldValues(id, force),
    fetchAllOpportunityHistory(id, force),
    loadDealEditTags(opp, force),
    fetchOpportunityDocuments(id, force),
  ]);

  return { opp, customFieldValues, history, tags, documents, oppId: id };
}

async function fetchOpportunityDocuments(oppId, force = false) {
  const id = Number(oppId);
  if (!Number.isFinite(id) || id <= 0) return [];
  try {
    // CRM opportunity attached files endpoint (proxy will forward)
    const path = `/api/2.0/crm/opportunity/${id}/files`;
    const data = await api(force ? bustCache(path) : path);
    return unwrap(data);
  } catch {
    return [];
  }
}

function appendPreviewSection(container, title, renderContent) {
  const section = document.createElement("section");
  section.className = "opp-preview-section";
  const h = document.createElement("h3");
  h.className = "opp-preview-section-title";
  h.textContent = title;
  section.appendChild(h);
  renderContent(section);
  container.appendChild(section);
}

function renderPreviewFieldGrid(parent, rows) {
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "opp-preview-empty";
    p.textContent = "None";
    parent.appendChild(p);
    return;
  }
  const dl = document.createElement("dl");
  dl.className = "opp-preview-fields";
  for (const { label, value } of rows) {
    const row = document.createElement("div");
    row.className = "opp-preview-field";
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (value === "Yes" || value === "No") {
      const tag = document.createElement("span");
      tag.className = "field-value-tag";
      tag.textContent = value;
      dd.appendChild(tag);
    } else if (label === "Tags") {
      const tags = value.split(",").map((t) => t.trim()).filter(Boolean);
      const AMBER_TAGS = new Set(["High Priority", "Needs Reconciliation", "Ready for carrier invoice", "Needs Rebuttal"]);
      for (const tagText of tags) {
        const tag = document.createElement("span");
        tag.className = "field-value-tag" + (AMBER_TAGS.has(tagText) ? " tag-amber" : "");
        tag.textContent = tagText;
        dd.appendChild(tag);
        dd.appendChild(document.createTextNode(" "));
      }
    } else {
      dd.textContent = value;
    }
    row.appendChild(dt);
    row.appendChild(dd);
    dl.appendChild(row);
  }
  parent.appendChild(dl);
}

/** Make phone numbers (tel:) and emails (mailto:) clickable inside preview modals (and similar content). */
function linkifyPhonesAndEmails(container) {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);
  for (const tnode of textNodes) {
    let txt = tnode.textContent || "";
    if (!txt || (!/@/.test(txt) && !/\d/.test(txt))) continue;
    const parent = tnode.parentNode;
    const parentText = (parent.textContent || "").toLowerCase();
    const ancestor = parent.closest ? parent.closest(".opp-preview-documents, .opp-preview-field, .opp-preview-history-item") : null;
    const contextText = ancestor ? ancestor.textContent.toLowerCase() : parentText;
    // Skip phones in obvious non-telephone number fields (address, claim number, policy number, ids, docs, etc.)
    // and any content inside the documents tab (doc titles, file ids, links etc. often contain digit sequences).
    let skipPhone = /address|claim|policy|document|file|ref|reference|number|id|doc|fileid|case|invoice|account|quote|estimate|report|serial|zip|postal|street/i.test(contextText) ||
                    (parent.closest && parent.closest(".opp-preview-documents"));
    if (!skipPhone && ancestor && ancestor.classList && ancestor.classList.contains("opp-preview-field")) {
      // For field rows, only allow phone linking if the label indicates a phone-related field.
      const labelEl = ancestor.querySelector("dt");
      const labelText = (labelEl ? labelEl.textContent : ancestor.textContent || "").toLowerCase();
      if (!/phone|tel|mobile|cell|fax|call|voice|pager|contact\s*(number|phone|tel|mobile)|phone\s*number/i.test(labelText)) {
        skipPhone = true;
      }
    }
    // Emails first (avoid phone overlap)
    txt = txt.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (m) => `<a href="mailto:${encodeURIComponent(m)}" class="preview-link">${m}</a>`);
    if (!skipPhone) {
      // Phones: keep display, sanitize for tel: (remove non-digits except leading +)
      txt = txt.replace(/(\+?[\d\s().-]{7,}\d)/g, (m) => {
        const clean = m.replace(/[^\d+]/g, "");
        if (clean.length < 7) return m;
        return `<a href="tel:${clean}" class="preview-link">${m}</a>`;
      });
    }
    if (txt !== tnode.textContent) {
      const wrap = document.createElement("span");
      wrap.innerHTML = txt;
      tnode.parentNode.replaceChild(wrap, tnode);
    }
  }
}

function renderOpportunityPreviewBody(data) {
  const body = $("#opp-preview-body");
  if (!body) return;
  body.innerHTML = "";
  renderOpportunityPreviewContent(body, data);
}

function setOpportunityPreviewCrmLink(oppId) {
  const wrap = $("#opp-preview-open-crm-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const link = createCrmOpenLink(oppId, { className: "opp-preview-open-crm" });
  wrap.appendChild(link);
}

function findGroupForOpportunity(oppId) {
  const id = Number(oppId);
  if (!Number.isFinite(id)) return null;
  for (const g of state.groups) {
    for (const col of groupOpportunities(g)) {
      for (const o of col.items || []) {
        if (Number(o.id ?? o.ID) === id) return g;
      }
    }
  }
  return null;
}

function setOpportunityPreviewContext(oppId, opp = null, group = null) {
  if (oppId == null) {
    oppPreviewContext = { oppId: null, opp: null, group: null };
    return;
  }
  const id = Number(oppId);
  oppPreviewContext = {
    oppId: Number.isFinite(id) ? id : null,
    opp: opp || null,
    group: group || null,
  };
}

async function openDealEditFromOpportunityPreview() {
  const { oppId, opp, group } = oppPreviewContext;
  if (oppId == null) {
    showToast("Opportunity not loaded", true);
    return;
  }
  let deal = opp;
  if (!deal) {
    try {
      deal = await fetchOpportunityForUpdate(oppId);
    } catch (err) {
      showToast(err.message, true);
      return;
    }
  }
  const refreshGroup = group || findGroupForOpportunity(oppId);
  // Open deal-edit (incl. its note editor) as a side popup to the LEFT of preview (instead of on top).
  // Allows viewing/scrolling preview history + interacting with note (and deal fields) simultaneously.
  // Escape in preview prefers closing the side editor first.
  try {
    await openDealEditModal(deal, refreshGroup);
  } catch (err) {
    showToast(err.message, true);
  }
}

function closeOpportunityPreviewModal() {
  restoreSideBySideCards();
  oppPreviewMailCache.clear();
  setOpportunityPreviewContext(null);
  $("#opp-preview-modal")?.classList.add("hidden");
}

function layoutSideBySideDealEditAndPreview() {
  const previewModal = $("#opp-preview-modal");
  // Support either deal-edit or quick-note as the side editor popup
  let sideModal = $("#deal-edit-modal");
  let isQuick = false;
  if (!sideModal || sideModal.classList.contains("hidden")) {
    sideModal = $("#quick-note-modal");
    isQuick = true;
  }
  if (!previewModal || previewModal.classList.contains("hidden") || !sideModal || sideModal.classList.contains("hidden")) return;
  const pCard = previewModal.querySelector(".modal-card");
  const sCard = sideModal.querySelector(".modal-card");
  if (!pCard || !sCard) return;

  // hook resize once for re-layout on orientation/resize
  if (!window._sideBySideResizeHooked) {
    window._sideBySideResizeHooked = true;
    window.addEventListener("resize", () => {
      const p = $("#opp-preview-modal");
      const d = $("#deal-edit-modal");
      const q = $("#quick-note-modal");
      if (p && !p.classList.contains("hidden") && ((d && !d.classList.contains("hidden")) || (q && !q.classList.contains("hidden")))) {
        layoutSideBySideDealEditAndPreview();
      }
    }, { passive: true });
  }

  if (pCard.dataset.origStyle == null) pCard.dataset.origStyle = pCard.getAttribute("style") || "";
  if (sCard.dataset.origStyle == null) sCard.dataset.origStyle = sCard.getAttribute("style") || "";

  const isMobile = window.innerWidth < 700;
  const gap = 12;
  let sideW, previewW, sideLeft, previewLeft, sideTop, previewTop;
  const baseTop = 20;

  if (isMobile) {
    // On mobile: fix the quick edit popup to the TOP of the deal preview modal (stacked vertically)
    // side on top, preview shifted below so both remain visible and interactive.
    const w = Math.min(720, window.innerWidth - 24);
    sideW = w;
    previewW = w;
    sideLeft = 12;
    previewLeft = 12;
    sideTop = baseTop;
    previewTop = baseTop + 180 + gap;  // lower initial guess; dynamic adjust will snap
  } else {
    // Desktop: side (left) + preview (right) side-by-side
    sideW = Math.min(440, Math.floor(window.innerWidth * 0.38));
    previewW = Math.min(680, Math.floor(window.innerWidth * 0.48));
    const total = sideW + previewW + gap;
    const left = Math.max(12, Math.floor((window.innerWidth - total) / 2));
    sideLeft = left;
    previewLeft = left + sideW + gap;
    sideTop = 36;
    previewTop = 36;
  }

  sCard.style.cssText = `position:fixed!important; left:${sideLeft}px!important; top:${sideTop}px!important; width:${sideW}px!important; max-height:${isMobile ? "40vh" : "92vh"}!important; overflow:auto!important; z-index:2100!important; margin:0!important; box-shadow:var(--shadow); pointer-events:auto!important;`;
  pCard.style.cssText = `position:fixed!important; left:${previewLeft}px!important; top:${previewTop}px!important; width:${previewW}px!important; max-height:${isMobile ? "55vh" : "92vh"}!important; overflow:auto!important; z-index:2005!important; margin:0!important; box-shadow:var(--shadow);`;

  if (isMobile) {
    // Improved mobile vertical stacking: side (edit/quick) fixed near top, preview pushed below it
    // with ~4px gap. Uses longer delay + rAF + ResizeObserver so dynamic content (note body, selects, tags)
    // doesn't cause the side to grow over the preview after initial measure. Constrains side max-height too.
    const adjustMobileVerticalStack = () => {
      if (!sCard || !pCard || sideModal.classList.contains("hidden") || previewModal.classList.contains("hidden")) return;
      const sRect = sCard.getBoundingClientRect();
      const desiredPTop = Math.max(baseTop + 80, sRect.bottom + 4);
      pCard.style.top = `${desiredPTop}px`;
      pCard.style.maxHeight = `calc(100vh - ${desiredPTop + 20}px)`;
      // keep side from growing infinitely over the preview area
      sCard.style.maxHeight = `min(45vh, calc(100vh - ${baseTop + 30}px))`;
    };

    // First paint adjust (longer than 25ms to let rich note, categories, tags fully layout)
    setTimeout(adjustMobileVerticalStack, 120);
    requestAnimationFrame(adjustMobileVerticalStack);

    // Live re-adjust if side resizes (user typing note, adding tags, etc.)
    if (!sCard._stackObserver) {
      sCard._stackObserver = new ResizeObserver(() => {
        clearTimeout(sCard._adjustT || 0);
        sCard._adjustT = setTimeout(adjustMobileVerticalStack, 40);
      });
      sCard._stackObserver.observe(sCard);
    }
  }

  // Hide side backdrop (preview's remains for dim)
  const sBack = sideModal.querySelector(".modal-backdrop");
  if (sBack) {
    sBack.style.display = "none";
    sBack.dataset.sideHidden = "1";
  }

  // Critical: allow interaction with preview while quick-edit is open.
  // The side .modal layer would otherwise block; pe:none on container + auto on its card lets events pass through except on the popup itself.
  sideModal.style.pointerEvents = "none";
  sideModal.style.zIndex = "2010";
  previewModal.style.zIndex = "2000";
}

/* Same layout logic but for search-popup modal instead of opp-preview-modal */
function layoutSideBySideDealEditAndSearchPopup() {
  const searchModal = $("#search-popup-modal");
  let sideModal = $("#deal-edit-modal");
  let isQuick = false;
  if (!sideModal || sideModal.classList.contains("hidden")) {
    sideModal = $("#quick-note-modal");
    isQuick = true;
  }
  if (!searchModal || searchModal.classList.contains("hidden") || !sideModal || sideModal.classList.contains("hidden")) return;
  const pCard = searchModal.querySelector(".modal-card");
  const sCard = sideModal.querySelector(".modal-card");
  if (!pCard || !sCard) return;

  if (pCard.dataset.origStyle == null) pCard.dataset.origStyle = pCard.getAttribute("style") || "";
  if (sCard.dataset.origStyle == null) sCard.dataset.origStyle = sCard.getAttribute("style") || "";

  const isMobile = window.innerWidth < 700;
  const gap = 12;
  let sideW, previewW, sideLeft, previewLeft, sideTop, previewTop;
  const baseTop = 20;

  if (isMobile) {
    const w = Math.min(900, window.innerWidth - 24);
    sideW = w;
    previewW = w;
    sideLeft = 12;
    previewLeft = 12;
    sideTop = baseTop;
    previewTop = baseTop + 180 + gap;
  } else {
    sideW = Math.min(440, Math.floor(window.innerWidth * 0.38));
    previewW = Math.min(900, Math.floor(window.innerWidth * 0.48));
    const total = sideW + previewW + gap;
    const left = Math.max(12, Math.floor((window.innerWidth - total) / 2));
    sideLeft = left;
    previewLeft = left + sideW + gap;
    sideTop = 36;
    previewTop = 36;
  }

  sCard.style.cssText = `position:fixed!important; left:${sideLeft}px!important; top:${sideTop}px!important; width:${sideW}px!important; max-height:${isMobile ? "40vh" : "92vh"}!important; overflow:auto!important; z-index:2100!important; margin:0!important; box-shadow:var(--shadow); pointer-events:auto!important;`;
  pCard.style.cssText = `position:fixed!important; left:${previewLeft}px!important; top:${previewTop}px!important; width:${previewW}px!important; max-height:${isMobile ? "55vh" : "92vh"}!important; overflow:auto!important; z-index:2005!important; margin:0!important; box-shadow:var(--shadow);`;

  if (isMobile) {
    const adjustMobileVerticalStack = () => {
      if (!sCard || !pCard || sideModal.classList.contains("hidden") || searchModal.classList.contains("hidden")) return;
      const sRect = sCard.getBoundingClientRect();
      const desiredPTop = Math.max(baseTop + 80, sRect.bottom + 4);
      pCard.style.top = `${desiredPTop}px`;
      pCard.style.maxHeight = `calc(100vh - ${desiredPTop + 20}px)`;
      sCard.style.maxHeight = `min(45vh, calc(100vh - ${baseTop + 30}px))`;
    };
    setTimeout(adjustMobileVerticalStack, 120);
    requestAnimationFrame(adjustMobileVerticalStack);
    if (!sCard._stackObserver) {
      sCard._stackObserver = new ResizeObserver(() => {
        clearTimeout(sCard._adjustT || 0);
        sCard._adjustT = setTimeout(adjustMobileVerticalStack, 40);
      });
      sCard._stackObserver.observe(sCard);
    }
  }

  const sBack = sideModal.querySelector(".modal-backdrop");
  if (sBack) {
    sBack.style.display = "none";
    sBack.dataset.sideHidden = "1";
  }
  sideModal.style.pointerEvents = "none";
  sideModal.style.zIndex = "2010";
  searchModal.style.zIndex = "2000";
}

function restoreSideBySideCards() {
  const previewModal = $("#opp-preview-modal");
  const searchModal = $("#search-popup-modal");
  const editModal = $("#deal-edit-modal");
  [previewModal, searchModal, editModal].forEach((modal) => {
    if (!modal) return;
    const card = modal.querySelector(".modal-card");
    if (card && card.dataset.origStyle != null) {
      card.setAttribute("style", card.dataset.origStyle);
      delete card.dataset.origStyle;
    }
  });
  if (editModal) {
    editModal.style.pointerEvents = "";
    editModal.style.zIndex = "";
    const eBack = editModal.querySelector(".modal-backdrop");
    if (eBack && eBack.dataset.sideHidden) {
      eBack.style.display = "";
      delete eBack.dataset.sideHidden;
    }
  }
  if (previewModal) {
    previewModal.style.zIndex = "";
  }
  if (searchModal) {
    searchModal.style.zIndex = "";
  }
}

function updatePreviewModalBookmarkButton(oppId) {
  const btn = $("#opp-preview-bookmark");
  if (!btn) return;
  const id = Number(oppId);
  const bookmarked = isDealBookmarked(id);
  btn.classList.toggle("bookmarked", bookmarked);
  btn.title = bookmarked ? "Remove bookmark" : "Bookmark deal";
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = bookmarkRibbonSvg(bookmarked);
}

async function openOpportunityPreviewModal(oppId, titleHint = "", group = null, force = false) {
  const modal = $("#opp-preview-modal");
  const body = $("#opp-preview-body");
  const titleEl = $("#opp-preview-title");
  if (!modal || !body || !titleEl) return;

  const id = Number(oppId);
  oppPreviewMailCache.clear();
  setOpportunityPreviewContext(id, null, group);
  titleEl.textContent = titleHint || "Opportunity";
  body.innerHTML = '<p class="opp-preview-loading">Loading opportunity…</p>';
  setOpportunityPreviewCrmLink(id);
  modal.classList.remove("hidden");
  updatePreviewModalBookmarkButton(id);

  try {
    const data = await fetchOpportunityPreviewData(id, force);
    const resolvedGroup = group || findGroupForOpportunity(id);
    setOpportunityPreviewContext(id, data.opp, resolvedGroup);
    titleEl.textContent = data.opp.title || data.opp.Title || titleHint || `Opportunity #${id}`;
    renderOpportunityPreviewBody(data);
    linkifyPhonesAndEmails(body);
    updateInferredStatus("preview", data.opp.title || data.opp.Title || titleHint || "");
  } catch (err) {
    body.innerHTML = `<p class="opp-preview-error">${escapeHtml(err.message)}</p>`;
    showToast(err.message, true);
  }
}

function bindOpportunityPreviewModal() {
  const modal = $("#opp-preview-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";
  $("#opp-preview-close")?.addEventListener("click", closeOpportunityPreviewModal);
  $("#opp-preview-refresh")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ctx = oppPreviewContext;
    if (ctx && ctx.oppId != null) {
      const titleHint = ctx.opp ? (ctx.opp.title || ctx.opp.Title || "") : "";
      // force=true bypasses the 30-second server-side proxy cache so the preview
      // always reflects the latest CRM data (tags, history, custom fields).
      openOpportunityPreviewModal(ctx.oppId, titleHint, ctx.group || null, true).catch(() => {});
    }
  });
  $("#opp-preview-edit")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDealEditFromOpportunityPreview();
  });
  $("#opp-preview-bookmark")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ctx = oppPreviewContext;
    if (!ctx || ctx.oppId == null) return;
    const id = Number(ctx.oppId);
    const title = ctx.opp ? (ctx.opp.title || ctx.opp.Title || "") : "";
    if (isDealBookmarked(id)) {
      removeBookmarkDeal(id);
    } else {
      addBookmarkDeal(id, title);
    }
    updatePreviewModalBookmarkButton(id);
  });
  modal.querySelectorAll("[data-opp-preview-dismiss]").forEach((el) => {
    el.addEventListener("click", closeOpportunityPreviewModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      const editM = $("#deal-edit-modal");
      if (editM && !editM.classList.contains("hidden")) {
        closeDealEditModal(); // close side note/edit popup first, keep preview
      } else {
        closeOpportunityPreviewModal();
      }
    }
  });
}

function bindGlobalOpportunitySearch() {
  const wrap = $("#global-opp-search");
  const input = $("#global-opp-search-input");
  const results = $("#global-opp-search-results");
  if (!wrap || !input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";

  let debounce;
  const hideResults = () => results.classList.add("hidden");

  const renderResults = (opps, q) => {
    results.innerHTML = "";
    if (!q.length) {
      hideResults();
      return;
    }
    results.classList.remove("hidden");
    if (q.length < 2 && !opps.length) {
      results.innerHTML = '<span class="search-empty">Type 2+ characters to search CRM</span>';
      return;
    }
    if (!opps.length) {
      results.innerHTML = '<span class="search-empty">No opportunities found</span>';
      return;
    }
    for (const o of opps) {
      const row = document.createElement("div");
      row.className = "global-opp-search-item";
      row.setAttribute("role", "option");

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "global-opp-search-item-title";
      titleBtn.textContent = o.title;
      titleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        input.value = "";
        hideResults();
        openOpportunityPreviewModal(o.id, o.title).catch((err) => showToast(err.message, true));
      });

      const openLink = createCrmOpenLink(o.id, {
        className: "global-opp-search-open",
        title: "Open in CRM",
      });

      row.appendChild(titleBtn);
      row.appendChild(openLink);
      results.appendChild(row);
    }
  };

  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      if (!q.length) {
        hideResults();
        return;
      }
      try {
        const opps = await searchOpportunitiesByTitle(q);
        renderResults(opps, q);
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      hideResults();
      input.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) hideResults();
  });
}

/* ================================================================================
   Search popup modal — large search with tabbed preview (max 5 tabs)
   ================================================================================ */

function bindSearchPopupBtn() {
  const btn = $("#search-popup-btn");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => openSearchPopupModal());
}

function openSearchPopupModal() {
  const modal = $("#search-popup-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  activateSearchPopupTab("search");
  const input = $("#search-popup-input");
  if (input) {
    input.focus();
    input.select();
  }
  populateSearchTagDropdown();
}

function populateSearchTagDropdown() {
  const select = $("#search-popup-tag-select");
  if (!select) return;
  select.innerHTML = '<option value="">— Select tag —</option>';
  const tags = state.allTags || [];
  const sorted = tags.map((t) => normalizeTagTitle(t.title ?? t)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  for (const title of sorted) {
    const opt = document.createElement("option");
    opt.value = title;
    opt.textContent = title;
    select.appendChild(opt);
  }
}

function closeSearchPopupModal() {
  const modal = $("#search-popup-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  // Clear all preview tabs
  for (const oppId of Array.from(searchPopupPreviewTabs.keys())) {
    closeSearchPreviewTab(oppId);
  }
  const input = $("#search-popup-input");
  if (input) input.value = "";
  const tagSelect = $("#search-popup-tag-select");
  if (tagSelect) tagSelect.value = "";
  const results = $("#search-popup-results");
  if (results) results.innerHTML = "";
  hideSearchPopupError();
}

function showSearchPopupError(msg) {
  const el = $("#search-popup-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  // Auto-hide after 5 seconds
  setTimeout(() => hideSearchPopupError(), 5000);
}

function hideSearchPopupError() {
  const el = $("#search-popup-error");
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
}

function bindSearchPopupModal() {
  const modal = $("#search-popup-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  $("#search-popup-close")?.addEventListener("click", closeSearchPopupModal);
  modal.querySelectorAll("[data-search-popup-dismiss]").forEach((el) => {
    el.addEventListener("click", closeSearchPopupModal);
  });

  // Escape closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      // Prefer closing deal-edit side modal first if open
      const editM = $("#deal-edit-modal");
      if (editM && !editM.classList.contains("hidden")) {
        closeDealEditModal();
        return;
      }
      closeSearchPopupModal();
    }
  });

  // Enter in search input
  const input = $("#search-popup-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        performSearchPopupQuery();
      }
    });
  }

  // Tag search button
  const tagSearchBtn = $("#search-popup-tag-search");
  if (tagSearchBtn) {
    tagSearchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      performSearchPopupTagQuery();
    });
  }

  // Tab bar click delegation
  const tabBar = $("#search-popup-tabs");
  if (tabBar) {
    tabBar.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".search-popup-tab");
      if (!tabBtn) return;
      const tabId = tabBtn.dataset.tab;
      if (!tabId) return;

      // Close button on preview tab
      const closeEl = e.target.closest(".search-popup-tab-close");
      if (closeEl) {
        const closeId = closeEl.dataset.closeTab;
        if (closeId != null) {
          closeSearchPreviewTab(Number(closeId));
          return;
        }
      }

      activateSearchPopupTab(tabId);
    });
  }
}

async function performSearchPopupQuery() {
  const input = $("#search-popup-input");
  const results = $("#search-popup-results");
  if (!input || !results) return;
  hideSearchPopupError();
  const q = input.value.trim();
  if (!q) {
    results.innerHTML = "";
    return;
  }

  results.innerHTML = '<p class="search-popup-results-empty">Searching…</p>';
  try {
    const params = new URLSearchParams({
      startIndex: "0",
      count: "100",
      filterValue: q,
      stageType: "0",
    });
    const data = await api(`/api/2.0/crm/opportunity/filter?${params}`);
    let opps = unwrap(data);
    if (opps.length) {
      opps = await enrichOpportunitiesTags(opps);
    }
    renderSearchPopupResults(opps);
  } catch (err) {
    results.innerHTML = `<p class="search-popup-results-empty">${escapeHtml(err.message)}</p>`;
  }
}

async function performSearchPopupTagQuery() {
  const select = $("#search-popup-tag-select");
  const results = $("#search-popup-results");
  if (!select || !results) return;
  hideSearchPopupError();
  const tagTitle = select.value.trim();
  if (!tagTitle) {
    showSearchPopupError("Please select a tag first");
    return;
  }

  results.innerHTML = '<p class="search-popup-results-empty">Searching…</p>';
  try {
    const params = new URLSearchParams({
      startIndex: "0",
      count: "100",
      stageType: "0",
    });
    const data = await api(`/api/2.0/crm/opportunity/filter?${params}`);
    let opps = unwrap(data);
    if (opps.length) {
      opps = await enrichOpportunitiesTags(opps);
      const catalog = buildTagCatalog();
      opps = opps.filter((o) => oppMatchesSelectedTags(o, [tagTitle], catalog));
    }
    renderSearchPopupResults(opps, tagTitle);
  } catch (err) {
    results.innerHTML = `<p class="search-popup-results-empty">${escapeHtml(err.message)}</p>`;
  }
}

function renderSearchPopupResults(opps, tagFilterLabel = null) {
  const results = $("#search-popup-results");
  if (!results) return;
  results.innerHTML = "";
  if (!opps.length) {
    results.innerHTML = tagFilterLabel
      ? `<p class="search-popup-results-empty">No open deals with tag "${escapeHtml(tagFilterLabel)}"</p>`
      : '<p class="search-popup-results-empty">No open deals found</p>';
    return;
  }

  if (tagFilterLabel) {
    const header = document.createElement("div");
    header.className = "search-popup-results-header";
    header.innerHTML = `<span class="search-popup-results-header-label">Deals tagged:</span> <span class="search-popup-results-header-tag">${escapeHtml(tagFilterLabel)}</span> <span class="search-popup-results-header-count">(${opps.length})</span>`;
    results.appendChild(header);
  }

  for (const o of opps) {
    const id = Number(o.id ?? o.ID);
    const title = (o.title || o.Title || `Deal #${id}`).trim();
    const stage = o.stage?.title || o.stage?.Title || o.Stage?.title || "";
    const due = formatOppDueLabel(o);
    const contact = getOpportunityContactLabel(o);
    const bid = formatMoney(o.bidValue || o.BidValue || 0);

    const metaParts = [stage, due, contact, bid].filter(Boolean);
    const meta = metaParts.join("  ·  ");

    const row = document.createElement("div");
    row.className = "search-popup-result-row";

    const titleEl = document.createElement("span");
    titleEl.className = "search-popup-result-title";
    titleEl.textContent = title;
    titleEl.title = title;

    const metaEl = document.createElement("span");
    metaEl.className = "search-popup-result-meta";
    metaEl.textContent = meta;
    metaEl.title = meta;

    const actions = document.createElement("span");
    actions.className = "search-popup-result-actions";

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "btn btn-primary";
    previewBtn.textContent = "+ Tab";
    previewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSearchPreviewTab(id, title);
    });

    const crmLink = createCrmOpenLink(id, {
      className: "opp-preview-open-crm",
      title: "Open in CRM",
    });

    actions.appendChild(previewBtn);
    actions.appendChild(crmLink);
    row.appendChild(titleEl);
    row.appendChild(metaEl);
    row.appendChild(actions);
    results.appendChild(row);
  }
}

async function openSearchPreviewTab(oppId, titleHint) {
  const id = Number(oppId);
  if (!Number.isFinite(id) || id <= 0) return;

  // If already open, just activate
  if (searchPopupPreviewTabs.has(id)) {
    activateSearchPopupTab(`preview-${id}`);
    updateInferredStatus("preview", searchPopupPreviewTabs.get(id).title || titleHint);
    return;
  }

  // Enforce max 5 tabs (stop at 5, show error if trying to open more)
  if (searchPopupPreviewTabs.size >= MAX_SEARCH_PREVIEW_TABS) {
    showSearchPopupError("Maximum 5 preview tabs reached. Close a tab to open another.");
    return;
  }

  // Create tab button
  const tabBar = $("#search-popup-tabs");
  const tabBtn = document.createElement("button");
  tabBtn.type = "button";
  tabBtn.className = "search-popup-tab";
  tabBtn.dataset.tab = `preview-${id}`;
  const shortTitle = titleHint.length > 24 ? titleHint.slice(0, 22) + "…" : titleHint;
  tabBtn.innerHTML = `
    <span class="search-popup-tab-title">${escapeHtml(shortTitle)}</span>
    <span class="search-popup-tab-close" data-close-tab="${id}" title="Close tab">×</span>
  `;
  tabBar.appendChild(tabBtn);

  // Create content container
  const containers = $("#search-popup-preview-containers");
  const container = document.createElement("div");
  container.className = "search-popup-tab-content";
  container.dataset.tabContent = `preview-${id}`;
  container.style.display = "none";
  const bookmarkIcon = bookmarkRibbonSvg(isDealBookmarked(id));
  container.innerHTML = `
    <div class="search-popup-preview-container">
        <div class="search-popup-preview-head">
        <h3 class="search-popup-preview-title">${escapeHtml(titleHint)}</h3>
        <div class="search-popup-preview-actions">
          <button type="button" class="search-popup-preview-refresh" data-refresh-id="${id}" title="Refresh">⟳</button>
          <button type="button" class="search-popup-preview-edit" data-edit-id="${id}" title="Edit deal">✎</button>
          <button type="button" class="search-popup-preview-bookmark" data-opp-id="${id}" title="Bookmark deal">${bookmarkIcon}</button>
          <span class="search-popup-preview-crm-wrap"></span>
        </div>
      </div>
      <div class="search-popup-preview-body" data-preview-body="${id}">
        <p class="opp-preview-loading">Loading opportunity…</p>
      </div>
    </div>
  `;
  containers.appendChild(container);

  // CRM link
  const crmWrap = container.querySelector(".search-popup-preview-crm-wrap");
  if (crmWrap) {
    crmWrap.appendChild(createCrmOpenLink(id, { className: "opp-preview-open-crm" }));
  }

  // Refresh button
  const refreshBtn = container.querySelector(".search-popup-preview-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      refreshSearchPreviewTab(id);
    });
  }

  // Edit button
  const editBtn = container.querySelector(".search-popup-preview-edit");
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSearchPreviewEdit(id);
    });
  }

  // Bookmark button
  const bookmarkBtn = container.querySelector(".search-popup-preview-bookmark");
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bid = Number(bookmarkBtn.dataset.oppId);
      if (isDealBookmarked(bid)) {
        removeBookmarkDeal(bid);
      } else {
        const fullTitle = titleHint;
        addBookmarkDeal(bid, fullTitle);
      }
    });
  }

  // Store
  searchPopupPreviewTabs.set(id, {
    title: titleHint,
    container,
    button: tabBtn,
    data: null,
  });

  // Activate immediately
  activateSearchPopupTab(`preview-${id}`);

  // Load data
  try {
    const data = await fetchOpportunityPreviewData(id, true);
    const body = container.querySelector(`[data-preview-body="${id}"]`);
    if (body) {
      body.innerHTML = "";
      renderOpportunityPreviewContent(body, data);
      linkifyPhonesAndEmails(body);
      updateInferredStatus("preview", data.opp?.title || data.opp?.Title || titleHint);
    }
    // Update title if loaded
    const fullTitle = data.opp?.title || data.opp?.Title || titleHint;
    const titleEl = container.querySelector(".search-popup-preview-title");
    if (titleEl) titleEl.textContent = fullTitle;
    // Update tab button title
    const shortFull = fullTitle.length > 24 ? fullTitle.slice(0, 22) + "…" : fullTitle;
    const tabTitleEl = tabBtn.querySelector(".search-popup-tab-title");
    if (tabTitleEl) tabTitleEl.textContent = shortFull;
    // Store data for edit
    const tab = searchPopupPreviewTabs.get(id);
    if (tab) tab.data = data;
  } catch (err) {
    const body = container.querySelector(`[data-preview-body="${id}"]`);
    if (body) {
      body.innerHTML = `<p class="opp-preview-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

async function refreshSearchPreviewTab(oppId) {
  const id = Number(oppId);
  const tab = searchPopupPreviewTabs.get(id);
  if (!tab) return;
  const body = tab.container.querySelector(`[data-preview-body="${id}"]`);
  if (body) {
    body.innerHTML = '<p class="opp-preview-loading">Refreshing…</p>';
  }
  try {
    const data = await fetchOpportunityPreviewData(id, true);
    if (body) {
      body.innerHTML = "";
      renderOpportunityPreviewContent(body, data);
      linkifyPhonesAndEmails(body);
    }
    // Update title
    const fullTitle = data.opp?.title || data.opp?.Title || tab.title;
    const titleEl = tab.container.querySelector(".search-popup-preview-title");
    if (titleEl) titleEl.textContent = fullTitle;
    const shortFull = fullTitle.length > 24 ? fullTitle.slice(0, 22) + "…" : fullTitle;
    const tabTitleEl = tab.button.querySelector(".search-popup-tab-title");
    if (tabTitleEl) tabTitleEl.textContent = shortFull;
    tab.data = data;
  } catch (err) {
    if (body) {
      body.innerHTML = `<p class="opp-preview-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

function closeSearchPreviewTab(oppId) {
  const id = Number(oppId);
  const tab = searchPopupPreviewTabs.get(id);
  if (!tab) return;

  tab.button.remove();
  tab.container.remove();
  searchPopupPreviewTabs.delete(id);

  // If this was the active tab, switch to search
  const tabBar = $("#search-popup-tabs");
  const activeBtn = tabBar?.querySelector(".search-popup-tab.active");
  if (!activeBtn || activeBtn.dataset.tab === `preview-${id}`) {
    activateSearchPopupTab("search");
  }
}

function activateSearchPopupTab(tabId) {
  const tabBar = $("#search-popup-tabs");
  const contents = document.querySelectorAll("#search-popup-modal .search-popup-tab-content");

  // Update tab buttons
  tabBar?.querySelectorAll(".search-popup-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Show/hide content
  contents.forEach((el) => {
    const isMatch = el.dataset.tabContent === tabId || el.dataset.tab === tabId;
    el.classList.toggle("active", isMatch);
    el.style.display = isMatch ? "" : "none";
  });

  // Hide preview containers wrapper when search tab is active so it doesn't take up flex space
  const previewContainers = $("#search-popup-preview-containers");
  if (previewContainers) {
    previewContainers.style.display = tabId === "search" ? "none" : "";
  }
}

async function handleSearchPreviewEdit(oppId) {
  const id = Number(oppId);
  let deal = null;
  const tab = searchPopupPreviewTabs.get(id);
  if (tab && tab.data && tab.data.opp) {
    deal = tab.data.opp;
  } else {
    try {
      deal = await fetchOpportunityForUpdate(id);
    } catch (err) {
      showToast(err.message, true);
      return;
    }
  }
  // Set preview context so side-by-side layout works (same as opp-preview-modal)
  setOpportunityPreviewContext(id, deal, null);
  try {
    await openDealEditModal(deal, null);
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ================================================================================
   Bookmark sidebar — collapsible right sidebar with bookmarked deal tabs
   ================================================================================ */

function isDealBookmarked(oppId) {
  return state.bookmarkedDeals.some((d) => Number(d.oppId) === Number(oppId));
}

function initBookmarkSidebar() {
  const sidebar = $("#bookmark-sidebar");
  const trigger = $("#bookmark-trigger");
  if (!sidebar || sidebar.dataset.bound) return;
  sidebar.dataset.bound = "1";

  renderBookmarkTabs();

  // Trigger tab click — open the sidebar
  if (trigger) {
    trigger.addEventListener("click", () => {
      sidebar.classList.remove("sidebar-hidden");
      trigger.classList.add("trigger-hidden");
    });
  }

  // Toggle button in sidebar header — close/hide the sidebar
  const toggleBtn = $("#bookmark-sidebar-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      hideBookmarkSidebar();
    });
  }

  // Tab bar delegation
  const tabBar = $("#bookmark-sidebar-tabs");
  if (tabBar) {
    tabBar.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".bookmark-tab");
      if (!tabBtn) return;
      const oppId = Number(tabBtn.dataset.oppId);
      if (!Number.isFinite(oppId) || oppId <= 0) return;

      // Bookmark icon on tab — click to remove bookmark
      if (e.target.closest(".bookmark-tab-icon")) {
        removeBookmarkDeal(oppId);
        return;
      }

      // Toggle: if already active, collapse; otherwise activate
      if (state.activeBookmarkTab === oppId) {
        closeBookmarkPreview();
      } else {
        activateBookmarkTab(oppId);
      }
    });
  }

  // Preview refresh
  const refreshBtn = $("#bookmark-preview-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const id = state.activeBookmarkTab;
      if (id) refreshBookmarkTab(id);
    });
  }

  // Preview unbookmark
  const unbookmarkBtn = $("#bookmark-preview-unbookmark");
  if (unbookmarkBtn) {
    unbookmarkBtn.addEventListener("click", () => {
      const id = state.activeBookmarkTab;
      if (id) removeBookmarkDeal(id);
    });
  }

  // Preview edit button — opens deal edit modal
  const editBtn = $("#bookmark-preview-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const id = state.activeBookmarkTab;
      if (!id) return;
      const deal = state.bookmarkedDeals.find((d) => Number(d.oppId) === id);
      if (!deal?._cachedData?.opp) return;
      openDealEditModal(deal._cachedData.opp, null).catch(() => {});
    });
  }

  // Preview collapse chevron — same behavior as clicking the deal name tab
  const collapseBtn = $("#bookmark-preview-collapse");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      closeBookmarkPreview();
    });
  }
}

function hideBookmarkSidebar() {
  const sidebar = $("#bookmark-sidebar");
  const trigger = $("#bookmark-trigger");
  if (sidebar) {
    closeBookmarkPreview();
    sidebar.classList.add("sidebar-hidden");
  }
  if (trigger) trigger.classList.remove("trigger-hidden");
}

function renderBookmarkTabs() {
  const tabBar = $("#bookmark-sidebar-tabs");
  if (!tabBar) return;
  tabBar.innerHTML = "";

  if (!state.bookmarkedDeals.length) {
    tabBar.innerHTML = '<div class="bookmark-tabs-empty">No bookmarked deals</div>';
    return;
  }

  for (let i = 0; i < state.bookmarkedDeals.length; i++) {
    const deal = state.bookmarkedDeals[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bookmark-tab" + (state.activeBookmarkTab === deal.oppId ? " active" : "");
    btn.dataset.oppId = deal.oppId;
    btn.draggable = true;
    btn.dataset.index = i;

    // Drag events
    btn.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", btn.dataset.index);
      btn.classList.add("bookmark-tab-dragging");
    });
    btn.addEventListener("dragend", () => {
      btn.classList.remove("bookmark-tab-dragging");
      tabBar.querySelectorAll(".bookmark-tab-drag-over").forEach((el) => el.classList.remove("bookmark-tab-drag-over"));
    });
    btn.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      tabBar.querySelectorAll(".bookmark-tab-drag-over").forEach((el) => el.classList.remove("bookmark-tab-drag-over"));
      btn.classList.add("bookmark-tab-drag-over");
    });
    btn.addEventListener("dragleave", () => {
      btn.classList.remove("bookmark-tab-drag-over");
    });
    btn.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("bookmark-tab-drag-over");
      tabBar.querySelectorAll(".bookmark-tab-drag-over").forEach((el) => el.classList.remove("bookmark-tab-drag-over"));

      const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
      const toIdx = parseInt(btn.dataset.index, 10);
      if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx) || fromIdx === toIdx) return;

      // Reorder array
      const [moved] = state.bookmarkedDeals.splice(fromIdx, 1);
      state.bookmarkedDeals.splice(toIdx, 0, moved);
      saveBookmarkedDealsToStorage();
      renderBookmarkTabs();
      // Re-activate the moved tab if it was active
      if (state.activeBookmarkTab === moved.oppId) {
        const activeEl = tabBar.querySelector(`.bookmark-tab[data-opp-id="${moved.oppId}"]`);
        if (activeEl) {
          activeEl.classList.add("active");
          // Scroll into view
          activeEl.scrollIntoView({ block: "nearest" });
        }
      }
    });

    // Stage dot color
    const stageColor = getStageColorForOppId(deal.oppId) || "#4f8cff";

    // Stage title and due date (from cache if available, else placeholder)
    let stageLabel = "";
    let dueLabel = "";
    if (deal._cachedData?.opp) {
      const opp = deal._cachedData.opp;
      stageLabel = resolveStageTitle(opp);
      const raw = opportunityDueDateRaw(opp);
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
          dueLabel = "Due " + d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        }
      }
    }

    btn.innerHTML = `
      <span class="bookmark-tab-icon">${bookmarkRibbonSvg(true)}</span>
      <span class="bookmark-tab-stage-dot" style="background:${escapeHtml(stageColor)}"></span>
      <span class="bookmark-tab-title">${escapeHtml(deal.title)}</span>
      <span class="bookmark-tab-meta">${escapeHtml(stageLabel)}${stageLabel && dueLabel ? " · " : ""}${escapeHtml(dueLabel)}</span>
    `;
    tabBar.appendChild(btn);
  }

  // Highlight active if any
  if (state.activeBookmarkTab) {
    const activeEl = tabBar.querySelector(`.bookmark-tab[data-opp-id="${state.activeBookmarkTab}"]`);
    if (activeEl) activeEl.classList.add("active");
  }
}

function getStageColorForOppId(oppId) {
  // Try cached data first
  const deal = state.bookmarkedDeals.find((d) => Number(d.oppId) === Number(oppId));
  if (deal?._cachedData?.opp?.stage?.id) {
    const stageId = String(deal._cachedData.opp.stage.id);
    const stage = state.stages.find((s) => String(s.id ?? s.ID) === stageId);
    return stage?.color || "#4f8cff";
  }
  // Try lookup in group opportunities
  for (const g of state.groups) {
    for (const opp of g.opportunities || []) {
      if (Number(opp.id ?? opp.ID) === Number(oppId)) {
        const stageId = String(opp.stage?.id ?? opp.stage?.ID);
        const stage = state.stages.find((s) => String(s.id ?? s.ID) === stageId);
        if (stage) return (g.stageColors && g.stageColors[stageId]) || stage.color || "#4f8cff";
      }
    }
  }
  return "#4f8cff";
}

async function activateBookmarkTab(oppId) {
  const id = Number(oppId);
  if (!Number.isFinite(id) || id <= 0) return;

  state.activeBookmarkTab = id;
  const previewPanel = $("#bookmark-sidebar-preview");
  const titleEl = $("#bookmark-preview-title");
  const bodyEl = $("#bookmark-preview-body");
  if (!previewPanel || !titleEl || !bodyEl) return;

  previewPanel.classList.remove("hidden");
  const deal = state.bookmarkedDeals.find((d) => Number(d.oppId) === id);

  // Use cached data if available
  if (deal?._cachedData) {
    titleEl.textContent = deal.title;
    bodyEl.innerHTML = "";
    renderOpportunityPreviewContent(bodyEl, deal._cachedData);
    linkifyPhonesAndEmails(bodyEl);
    updateInferredStatus("preview", deal.title || `Opportunity #${id}`);
  } else {
    titleEl.textContent = deal?.title || `Opportunity #${id}`;
    bodyEl.innerHTML = '<p class="opp-preview-loading">Loading opportunity…</p>';
  }

  // Fetch data in background (always refresh if not cached, or on explicit refresh only)
  if (!deal?._cachedData) {
    try {
      const data = await fetchOpportunityPreviewData(id, false);
      if (state.activeBookmarkTab !== id) return; // tab changed while loading
      // Cache it
      if (deal) deal._cachedData = data;
      titleEl.textContent = data.opp?.title || data.opp?.Title || deal?.title || `Opportunity #${id}`;
      bodyEl.innerHTML = "";
      renderOpportunityPreviewContent(bodyEl, data);
      linkifyPhonesAndEmails(bodyEl);
      updateInferredStatus("preview", data.opp?.title || data.opp?.Title || deal?.title || `Opportunity #${id}`);
      // Update tab's stage/due info
      renderBookmarkTabs();
    } catch (err) {
      if (state.activeBookmarkTab === id) {
        bodyEl.innerHTML = `<p class="opp-preview-error">${escapeHtml(err.message)}</p>`;
      }
    }
  }

  renderBookmarkTabs();
}

function closeBookmarkPreview() {
  state.activeBookmarkTab = null;
  const previewPanel = $("#bookmark-sidebar-preview");
  if (previewPanel) previewPanel.classList.add("hidden");
  renderBookmarkTabs();
}

function addBookmarkDeal(oppId, title) {
  const id = Number(oppId);
  if (!Number.isFinite(id) || id <= 0) return;
  if (isDealBookmarked(id)) return;

  if (state.bookmarkedDeals.length >= MAX_BOOKMARKED_DEALS) {
    showToast(`Maximum ${MAX_BOOKMARKED_DEALS} bookmarked deals reached. Remove one to add another.`, true);
    return;
  }

  state.bookmarkedDeals.push({
    oppId: id,
    title: String(title || "").trim() || `Opportunity #${id}`,
    addedAt: new Date().toISOString(),
  });

  saveBookmarkedDealsToStorage();
  closeBookmarkPreview(); // collapse if expanded
  renderBookmarkTabs();
  refreshAllBookmarkButtonStates();
}

function removeBookmarkDeal(oppId) {
  const id = Number(oppId);
  state.bookmarkedDeals = state.bookmarkedDeals.filter((d) => Number(d.oppId) !== id);

  if (state.activeBookmarkTab === id) {
    closeBookmarkPreview();
  }

  saveBookmarkedDealsToStorage();
  renderBookmarkTabs();
  refreshAllBookmarkButtonStates();
}

async function refreshBookmarkTab(oppId) {
  const id = Number(oppId);
  const deal = state.bookmarkedDeals.find((d) => Number(d.oppId) === id);
  if (!deal) return;

  const bodyEl = $("#bookmark-preview-body");
  if (bodyEl) bodyEl.innerHTML = '<p class="opp-preview-loading">Refreshing…</p>';

  try {
    const data = await fetchOpportunityPreviewData(id, true);
    deal._cachedData = data;
    const titleEl = $("#bookmark-preview-title");
    if (titleEl) titleEl.textContent = data.opp?.title || data.opp?.Title || deal.title;
    if (bodyEl) {
      bodyEl.innerHTML = "";
      renderOpportunityPreviewContent(bodyEl, data);
      linkifyPhonesAndEmails(bodyEl);
    }
    renderBookmarkTabs();
  } catch (err) {
    if (bodyEl) {
      bodyEl.innerHTML = `<p class="opp-preview-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

function refreshAllBookmarkButtonStates() {
  document.querySelectorAll(".card-bookmark-btn").forEach((btn) => {
    const oppId = Number(btn.dataset.oppId);
    const bookmarked = isDealBookmarked(oppId);
    btn.classList.toggle("bookmarked", bookmarked);
    btn.title = bookmarked ? "Remove bookmark" : "Bookmark deal";
    btn.setAttribute("aria-label", btn.title);
    btn.innerHTML = bookmarkRibbonSvg(bookmarked);
  });
  // Also update search popup preview bookmark buttons
  document.querySelectorAll(".search-popup-preview-bookmark").forEach((btn) => {
    const oppId = Number(btn.dataset.oppId);
    const bookmarked = isDealBookmarked(oppId);
    btn.classList.toggle("bookmarked", bookmarked);
    btn.title = bookmarked ? "Remove bookmark" : "Bookmark deal";
    btn.setAttribute("aria-label", btn.title);
    btn.innerHTML = bookmarkRibbonSvg(bookmarked);
  });
  const ctx = oppPreviewContext;
  if (ctx && ctx.oppId != null) {
    updatePreviewModalBookmarkButton(ctx.oppId);
  }
}

/* ================================================================================
   Render opportunity preview content into any container (reused by modal + tabs)
   ================================================================================ */

function renderOpportunityPreviewContent(container, data) {
  if (!container) return;
  container.innerHTML = "";

  const { opp, customFieldValues, history, tags, documents } = data;
  const standardRows = buildOpportunityPreviewStandardFields(opp, tags);
  const userRows = buildOpportunityPreviewUserFields(opp, customFieldValues);
  const description = String(opp.description ?? opp.Description ?? "").trim();

  // Tabs at top
  const tabs = document.createElement("div");
  tabs.className = "opp-preview-tabs";
  const tabDetails = document.createElement("button");
  tabDetails.type = "button";
  tabDetails.className = "opp-preview-tab active";
  tabDetails.textContent = "Details";
  tabDetails.dataset.tab = "details";
  const tabDocs = document.createElement("button");
  tabDocs.type = "button";
  tabDocs.className = "opp-preview-tab";
  tabDocs.textContent = "Documents";
  tabDocs.dataset.tab = "documents";
  tabs.appendChild(tabDetails);
  tabs.appendChild(tabDocs);
  container.appendChild(tabs);

  // Details content
  const detailsContent = document.createElement("div");
  detailsContent.className = "opp-preview-tab-content";
  detailsContent.dataset.tabContent = "details";

  appendPreviewSection(detailsContent, "Deal fields", (section) => {
    renderPreviewFieldGrid(section, standardRows);
  });

  appendPreviewSection(detailsContent, "Description", (section) => {
    if (!description) {
      const p = document.createElement("p");
      p.className = "opp-preview-empty";
      p.textContent = "No description";
      section.appendChild(p);
      return;
    }
    const p = document.createElement("p");
    p.className = "opp-preview-description";
    p.textContent = description;
    section.appendChild(p);
  });

  appendPreviewSection(detailsContent, "User fields", (section) => {
    renderPreviewFieldGrid(section, userRows);
  });

  appendPreviewSection(detailsContent, "History & notes", (section) => {
    if (!history.length) {
      const p = document.createElement("p");
      p.className = "opp-preview-empty";
      p.textContent = "No history events";
      section.appendChild(p);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "opp-preview-history";
    for (const ev of history) {
      ul.appendChild(renderHistoryEventItem(ev));
    }
    section.appendChild(ul);
  });

  container.appendChild(detailsContent);

  // Documents tab
  const docsContent = document.createElement("div");
  docsContent.className = "opp-preview-tab-content";
  docsContent.dataset.tabContent = "documents";
  docsContent.style.display = "none";

  const docs = documents || [];
  if (!docs.length) {
    const p = document.createElement("p");
    p.className = "opp-preview-empty";
    p.textContent = "No documents attached to this deal";
    docsContent.appendChild(p);
  } else {
    const ul = document.createElement("ul");
    ul.className = "opp-preview-documents";
    for (const d of docs) {
      const li = document.createElement("li");
      const fid = d.id ?? d.ID ?? d.fileId ?? d.FileId ?? "";
      const base = (state.portalUrl || "").replace(/\/$/, "");

      const a = document.createElement("a");
      a.href = fid ? `${base}/Products/Files/DocEditor.aspx?fileid=${fid}` : "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = d.title || d.Title || d.name || d.Name || "Document";
      a.style.color = "inherit";
      a.style.textDecoration = "none";
      li.appendChild(a);

      if (fid) {
        const dl = document.createElement("a");
        dl.href = portalFileDownloadUrl ? portalFileDownloadUrl(fid) : `${base}/Products/Files/HttpHandlers/filehandler.ashx?action=download&fileid=${fid}`;
        dl.title = "Download";
        dl.setAttribute("aria-label", "Download document");
        dl.setAttribute("download", "");
        dl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
        dl.style.marginLeft = '0.5em';
        dl.style.textDecoration = 'none';
        dl.style.fontSize = '0.9em';
        dl.style.display = 'inline-flex';
        dl.style.alignItems = 'center';
        dl.target = '_blank';
        dl.rel = 'noopener';
        li.appendChild(dl);
      }

      ul.appendChild(li);
    }
    docsContent.appendChild(ul);
  }

  container.appendChild(docsContent);

  // Tab switching
  const activateTab = (tabName) => {
    tabs.querySelectorAll('.opp-preview-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    detailsContent.style.display = tabName === 'details' ? '' : 'none';
    docsContent.style.display = tabName === 'documents' ? '' : 'none';
  };
  tabDetails.addEventListener('click', () => activateTab('details'));
  tabDocs.addEventListener('click', () => activateTab('documents'));
}

function bindNewTaskOpportunityPicker() {
  const input = $("#new-task-opportunity-search");
  const results = $("#new-task-opportunity-results");
  if (!input || !results || input.dataset.bound) return;
  input.dataset.bound = "1";
  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const q = input.value.trim();
      results.innerHTML = "";
      if (q.length < 1) {
        results.classList.add("hidden");
        return;
      }
      try {
        const opps = await searchOpportunitiesForTaskPicker(q);
        results.classList.remove("hidden");
        if (!opps.length) {
          results.innerHTML = '<button type="button" disabled>No matches</button>';
          return;
        }
        for (const o of opps) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = o.title;
          btn.addEventListener("click", () => setNewTaskOpportunitySelection(o.id, o.title));
          results.appendChild(btn);
        }
      } catch (err) {
        showToast(err.message, true);
      }
    }, 300);
  });
  document.addEventListener("click", (e) => {
    const wrap = input.closest(".opportunity-picker-field");
    if (wrap && !wrap.contains(e.target)) results.classList.add("hidden");
  });
}

/** CRM create-task uses `deadline` (ISO), not read-model `deadLine`. */
function toApiTaskDeadline(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T17:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function resolveTaskCategoryId(formCategoryId) {
  const picked = formCategoryId != null && String(formCategoryId).trim() !== "" ? Number(formCategoryId) : NaN;
  if (Number.isFinite(picked) && picked > 0) return picked;
  const first = state.taskCategories[0];
  const fallback = Number(first?.id ?? first?.ID);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return null;
}

function buildCreateTaskBody(form) {
  const title = form.title?.trim();
  if (!title) throw new Error("Task title is required");

  const responsibleId = form.responsibleId?.trim();
  if (!responsibleId) throw new Error("Assigned user is required");

  const categoryId = resolveTaskCategoryId(form.categoryId);
  if (categoryId == null) {
    throw new Error("No task category available. Reload the page or check CRM task categories.");
  }

  const body = {
    title,
    description: form.description?.trim() || "",
    responsibleId,
    categoryId,
    isNotify: !!form.isNotify,
  };

  const deadline = toApiTaskDeadline(form.deadLine);
  if (deadline) body.deadline = deadline;

  const oppId = state.newTaskOpportunity.id;
  if (oppId != null && Number.isFinite(oppId)) {
    body.entityType = "opportunity";
    body.entityId = oppId;
  }

  return body;
}

function unwrapCreatedEntity(data) {
  const r = data?.response ?? data?.result ?? data;
  if (r && typeof r === "object") return r;
  return data;
}

async function createCrmTask(body) {
  const res = await withCrmQueueOnTransient(
    () => api("/api/2.0/crm/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      showCrashBanner: false,
    }),
    {
      method: "POST",
      path: "/api/2.0/crm/task",
      body: JSON.stringify(body),
      description: `Create task "${body?.title || body?.Title || 'untitled'}"`,
      opType: "task",
      targetId: body?.entityId ? String(body.entityId) : undefined,
    }
  );
  if (res && res.queued) {
    // Return a shape the caller can detect (it currently only uses the success path for ID)
    return { queued: true };
  }
  return res;
}

async function notifyCrmTaskResponsible(taskId) {
  try {
    await api(`/api/2.0/crm/task/${taskId}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    /* optional */
  }
}

async function submitNewTaskForm(e) {
  e.preventDefault();
  setTaskModalError("");
  const form = e.target;
  const submitBtn = $("#task-modal-submit");
  if (submitBtn) submitBtn.disabled = true;

  // Small tooltip-like note below the button on press.
  const submittingNote = showSubmittingNote(submitBtn);

  // Show progress immediately on button press (bottom right, with bar).
  // This ensures the indicator appears right when the user commits the action.
  setConnectionState('connected');
  showCRMSyncStatus('Connecting...');

  const connectStart = Date.now();

  // Cap popup visible time at 2.5s max. Safe to close sooner because data is saved locally first (optimistic + queue).
  // The status bar + toasts carry the result.
  const closeTimer = setTimeout(() => {
    closeNewTaskModal();
  }, 2500);

  try {
    const body = buildCreateTaskBody({
      title: $("#new-task-title")?.value,
      description: $("#new-task-description")?.value,
      deadLine: $("#new-task-deadline")?.value,
      responsibleId: $("#new-task-responsible")?.value,
      categoryId: $("#new-task-category")?.value,
      isNotify: $("#new-task-notify")?.checked,
    });
    const data = await createCrmTask(body);
    if (data && data.queued) {
      // Transient failure — already enqueued + toasted by the wrapper.
      // Close the modal (user action "succeeded" from their perspective) and let the
      // processor + loadTasks reconcile when it succeeds.
      clearTimeout(closeTimer);
      closeNewTaskModal();
      // The enqueueCrmMutation already showed the "queued" toast.
      await loadTasks().catch(() => {});
      return;
    }
    const created = unwrapCreatedEntity(data);
    const taskId = created?.id ?? created?.ID ?? data?.id ?? data?.ID;
    if ($("#new-task-notify")?.checked && taskId != null) {
      await notifyCrmTaskResponsible(taskId);
    }
    clearTimeout(closeTimer);
    closeNewTaskModal();
    hideCRMSyncStatus();  // clear any "Connecting..." immediately on successful response
    // Once the CRM server has successfully received the push, go straight to success.
    // No lingering "Connected & Syncing..." after the event.
    onCRMSuccess();
    showCRMSyncStatus('Task sent successfully');
    setTimeout(() => {
      hideCRMSyncStatus();
    }, 1500);
    await loadTasks();
  } catch (err) {
    clearTimeout(closeTimer);
    setTaskModalError(err.message || "Could not create task");
    hideCRMSyncStatus();
  } finally {
    clearTimeout(closeTimer);
    if (submitBtn) submitBtn.disabled = false;
    if (submittingNote && submittingNote.parentNode) submittingNote.parentNode.removeChild(submittingNote);
  }
}

async function openNewTaskModal() {
  const modal = $("#task-modal");
  const form = $("#task-modal-form");
  if (!modal || !form) return;

  setTaskModalError("");
  form.reset();
  clearNewTaskOpportunitySelection();

  await loadTaskCategories(); // uses local cache if present (populated on login); never blocks on network when down
  populateNewTaskCategorySelect();
  populateNewTaskResponsibleSelect();

  const notify = $("#new-task-notify");
  if (notify) notify.checked = true;

  modal.classList.remove("hidden");
  $("#new-task-title")?.focus();
}

function bindNewTaskModal() {
  const modal = $("#task-modal");
  const form = $("#task-modal-form");
  if (!modal || !form || form.dataset.bound) return;
  form.dataset.bound = "1";

  form.addEventListener("submit", (e) => {
    submitNewTaskForm(e).catch((err) => setTaskModalError(err.message));
  });

  $("#task-modal-cancel")?.addEventListener("click", closeNewTaskModal);
  modal.querySelectorAll("[data-task-modal-dismiss]").forEach((el) => {
    el.addEventListener("click", closeNewTaskModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeNewTaskModal();
  });

  bindNewTaskOpportunityPicker();
}

async function loadTasks() {
  if (tileBodyCollapsed("tile-tasks")) {
    showTileCollapsedHint("tile-tasks", "Minimized — expand to load tasks");
    return;
  }
  renderTasksTile();
  const params = new URLSearchParams({ startIndex: "0", count: "200", isClosed: "false" });
  const filterUser = $("#tasks-user-filter")?.value;
  if (filterUser) params.set("responsibleid", filterUser);

  const data = await api(`/api/2.0/crm/task/filter?${params}`);
  state.tasks = unwrap(data).filter((t) => !t.isClosed);
  populateTasksUserFilter();
  renderTasksByUser();
}

async function openTasksListModal() {
  const modal = $("#tasks-list-modal");
  const bodyEl = $("#tasks-list-body");
  const showCompletedCb = $("#tasks-list-show-completed");
  if (!modal || !bodyEl || !showCompletedCb) return;

  let allTasks = [];

  const fetchAll = async () => {
    const paramsOpen = new URLSearchParams({ startIndex: "0", count: "500", isClosed: "false" });
    const paramsClosed = new URLSearchParams({ startIndex: "0", count: "500", isClosed: "true" });
    const [openData, closedData] = await Promise.all([
      api(`/api/2.0/crm/task/filter?${paramsOpen}`),
      api(`/api/2.0/crm/task/filter?${paramsClosed}`),
    ]);
    const opens = unwrap(openData);
    const closeds = unwrap(closedData);
    allTasks = [...opens, ...closeds].sort((a, b) => taskSortMs(a) - taskSortMs(b));
  };

  const renderList = () => {
    bodyEl.innerHTML = "";
    const showClosed = !!showCompletedCb.checked;
    const filtered = allTasks.filter((t) => showClosed || !t.isClosed);
    if (!filtered.length) {
      bodyEl.innerHTML = '<p class="modal-message">No tasks to show.</p>';
      return;
    }
    filtered.forEach((task) => {
      const row = document.createElement("div");
      row.className = `tasks-list-row ${task.isClosed ? "done" : ""}`;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!task.isClosed;

      cb.addEventListener("change", async () => {
        cb.disabled = true;
        const wasClosed = !!task.isClosed;
        try {
          if (cb.checked && !wasClosed) {
            const res = await withCrmQueueOnTransient(
              () => api(`/api/2.0/crm/task/${task.id}/close`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: "{}",
                showCrashBanner: false,
              }),
              {
                method: "PUT",
                path: `/api/2.0/crm/task/${task.id}/close`,
                body: "{}",
                description: `Close task ${task.id}`,
                opType: "task",
                targetId: String(task.id),
              }
            );
            if (res && res.queued) {
              // Keep optimistic toggle; processor will reconcile
            } else {
              task.isClosed = true;
            }
          } else if (!cb.checked && wasClosed) {
            const res = await withCrmQueueOnTransient(
              () => api(`/api/2.0/crm/task/${task.id}/reopen`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: "{}",
                showCrashBanner: false,
              }),
              {
                method: "PUT",
                path: `/api/2.0/crm/task/${task.id}/reopen`,
                body: "{}",
                description: `Reopen task ${task.id}`,
                opType: "task",
                targetId: String(task.id),
              }
            );
            if (res && res.queued) {
              // keep optimistic
            } else {
              task.isClosed = false;
            }
          }
          row.classList.toggle("done", !!task.isClosed);
          // Toast the immediate action. The enqueue already surfaces "queued" when transient.
          // Processor will surface "Synced" on recovery.
          showToast(task.isClosed ? "Task marked complete" : "Task reopened");
          // refresh main tasks tile if present
          setTimeout(() => { loadTasks().catch(() => {}); }, 200);
        } catch (err) {
          cb.checked = wasClosed;
          showToast(err.message, true);
        } finally {
          cb.disabled = false;
        }
      });

      const label = document.createElement("label");
      const titleLink = document.createElement("a");
      titleLink.textContent = task.title || "(Task)";
      titleLink.style.cursor = "pointer";
      titleLink.addEventListener("click", (ev) => {
        ev.preventDefault();
        openTaskPreviewModal(task);
      });
      label.appendChild(titleLink);

      if (task.deadLine?.value || task.deadLine) {
        const dl = document.createElement("span");
        dl.className = "feed-meta";
        dl.textContent = `Due ${new Date(task.deadLine?.value || task.deadLine).toLocaleDateString()}`;
        label.appendChild(dl);
      }

      row.appendChild(cb);
      row.appendChild(label);
      bodyEl.appendChild(row);
    });
  };

  try {
    await fetchAll();
  } catch (err) {
    bodyEl.innerHTML = `<p class="modal-error">Failed to load tasks: ${escapeHtml(err.message)}</p>`;
    modal.classList.remove("hidden");
    return;
  }

  renderList();

  if (!showCompletedCb.dataset.bound) {
    showCompletedCb.dataset.bound = "1";
    showCompletedCb.addEventListener("change", renderList);
  }

  if (!modal.dataset.bound) {
    modal.dataset.bound = "1";
    $("#tasks-list-close")?.addEventListener("click", () => modal.classList.add("hidden"));
    modal.querySelectorAll("[data-tasks-list-dismiss]").forEach((el) => {
      el.addEventListener("click", () => modal.classList.add("hidden"));
    });
    $("#tasks-list-new")?.addEventListener("click", () => {
      modal.classList.add("hidden");
      openNewTaskModal().catch((e) => showToast(e.message, true));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
      }
    });
  }

  modal.classList.remove("hidden");
}

function openTaskPreviewModal(task) {
  const modal = $("#task-preview-modal");
  const titleEl = $("#task-preview-modal-title");
  const body = $("#task-preview-body");
  const crmLink = $("#task-preview-crm-link");
  if (!modal || !titleEl || !body || !crmLink) return;

  titleEl.textContent = task.title || "Task";
  crmLink.href = crmTaskUrl(task);
  crmLink.target = "_blank";
  crmLink.rel = "noopener noreferrer";

  const created = task.createOn?.value ?? task.createOn ?? task.created?.value ?? task.created ?? task.dateAndTime;
  const createdStr = created ? new Date(created).toLocaleString() : "Unknown";
  const responsible = task.responsible ? (task.responsible.displayName || task.responsible.userName || task.responsible.id) : "Unknown";
  const desc = (task.description || task.Description || "No description").replace(/</g, "&lt;");
  const due = task.deadLine?.value || task.deadLine ? new Date(task.deadLine?.value || task.deadLine).toLocaleDateString() : "None";

  let html = `
    <p><strong>Created by:</strong> ${responsible} on ${createdStr}</p>
    <p><strong>Due:</strong> ${due}</p>
    <p><strong>Description:</strong> ${desc}</p>
  `;
  if (task.entity?.entityType === "opportunity" && task.entity.entityTitle) {
    html += `
      <p><strong>Linked Deal:</strong> ${task.entity.entityTitle}
        <button type="button" class="btn btn-ghost btn-icon-only" title="Preview deal" data-preview-deal>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
        </button>
      </p>
    `;
  }

  body.innerHTML = html;
  linkifyPhonesAndEmails(body);

  // Attach click handler directly (avoids inline onclick global lookup / ReferenceError in some contexts)
  const previewBtn = body.querySelector('[data-preview-deal]');
  if (previewBtn && task.entity) {
    previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openOpportunityPreviewModal(task.entity.entityId, task.entity.entityTitle || '');
    });
  }

  if (!modal.dataset.bound) {
    modal.dataset.bound = "1";
    modal.addEventListener("click", (e) => {
      if (e.target.hasAttribute("data-task-preview-dismiss") || e.target.classList.contains("modal-backdrop")) {
        modal.classList.add("hidden");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
      }
    });
  }

  modal.classList.remove("hidden");
}

function populateTasksUserFilter() {
  const sel = $("#tasks-user-filter");
  if (!sel) return;
  const preferred = sel.value || state.currentUserId || "";
  sel.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All users";
  sel.appendChild(allOpt);

  const users = new Map();
  for (const u of state.portalUsers) {
    users.set(String(u.id), u.displayName || u.id);
  }
  for (const t of state.tasks) {
    const r = t.responsible;
    if (r?.id) users.set(String(r.id), r.displayName || r.userName || r.id);
  }
  if (state.currentUserId && !users.has(String(state.currentUserId))) {
    users.set(String(state.currentUserId), state.currentUserName || state.currentUserId);
  }

  for (const [id, name] of [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    sel.appendChild(opt);
  }

  if (preferred && [...sel.options].some((o) => o.value === String(preferred))) {
    sel.value = String(preferred);
  } else if (state.currentUserId) {
    sel.value = String(state.currentUserId);
  }
}

function taskSortMs(task) {
  const due = task.deadLine?.value ?? task.deadLine ?? task.deadline;
  if (due) {
    const t = new Date(due).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const created =
    task.createOn?.value ?? task.createOn ?? task.created?.value ?? task.created ?? task.dateAndTime;
  const c = new Date(created || 0).getTime();
  return Number.isNaN(c) ? 0 : c;
}

function isTaskOverdue(task) {
  const deadline = task.deadLine?.value || task.deadLine;
  if (!deadline) return false;
  const due = new Date(deadline);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return diffMs > 3 * 24 * 60 * 60 * 1000;
}

function createTaskRow(task) {
  const row = document.createElement("div");
  row.className = "task-row" + (isTaskOverdue(task) ? " task-row--overdue" : "");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.addEventListener("change", async () => {
    if (!cb.checked) return;
    cb.disabled = true;
    try {
      await api(`/api/2.0/crm/task/${task.id}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      row.classList.add("done");
      showToast("Task marked complete");
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      setTimeout(() => {
        row.remove();
        renderTasksByUser();
      }, 400);
    } catch (err) {
      cb.checked = false;
      cb.disabled = false;
      showToast(err.message, true);
    }
  });

  const label = document.createElement("label");
  const titleLink = document.createElement("a");
  titleLink.textContent = task.title || "(Task)";
  titleLink.style.cursor = "pointer";
  titleLink.addEventListener("click", (ev) => {
    ev.preventDefault();
    openTaskPreviewModal(task);
  });
  label.appendChild(titleLink);
  if (task.deadLine?.value || task.deadLine) {
    const dl = document.createElement("span");
    dl.className = "feed-meta";
    dl.textContent = `Due ${new Date(task.deadLine?.value || task.deadLine).toLocaleDateString()}`;
    label.appendChild(dl);
  }
  if (task.entity?.entityType === "opportunity" && task.entity.entityTitle) {
    const ent = document.createElement("a");
    ent.className = "feed-meta";
    ent.textContent = task.entity.entityTitle;
    ent.style.cursor = "pointer";
    ent.addEventListener("click", (ev) => {
      ev.preventDefault();
      openOpportunityPreviewModal(task.entity.entityId, task.entity.entityTitle || "");
    });
    label.appendChild(ent);
  }

  const desc = (task.description || task.Description || "").trim();
  if (desc) {
    const d = document.createElement("span");
    d.className = "task-desc feed-meta";
    d.textContent = desc.length > 120 ? desc.slice(0, 117) + "…" : desc;
    label.appendChild(d);
  }

  row.appendChild(cb);
  row.appendChild(label);
  return row;
}

function renderTasksByUser() {
  const root = $("#tasks-by-user");
  if (!root) return;
  root.innerHTML = "";
  const tasksTile = document.querySelector('[data-tile-id="tile-tasks"]');
  const fullWidth = tasksTile?.classList.contains("panel-width-full");
  root.className = fullWidth ? "tasks-by-user tasks-by-user-columns" : "tasks-by-user";

  const filterUser = $("#tasks-user-filter")?.value;
  let tasks = state.tasks;
  if (filterUser) {
    tasks = tasks.filter((t) => String(t.responsible?.id) === String(filterUser));
  }

  updatePanelTileCount("tile-tasks", tasks.length);

  if (!tasks.length) {
    root.innerHTML = '<p class="board-loading">No open tasks.</p>';
    return;
  }

  if (fullWidth) {
    const sorted = [...tasks].sort((a, b) => {
      const da = new Date(a.deadline || a.Deadline || 0).getTime() || Infinity;
      const db = new Date(b.deadline || b.Deadline || 0).getTime() || Infinity;
      return da - db;
    });
    const colCount = 3;
    const perCol = Math.ceil(sorted.length / colCount);
    for (let c = 0; c < colCount; c++) {
      const col = document.createElement("div");
      col.className = "tasks-column";
      for (const task of sorted.slice(c * perCol, (c + 1) * perCol)) {
        col.appendChild(createTaskRow(task));
      }
      root.appendChild(col);
    }
    return;
  }

  const byUser = new Map();
  for (const task of tasks) {
    const r = task.responsible;
    const key = r?.id || "_none";
    const name = r?.displayName || "Unassigned";
    if (!byUser.has(key)) byUser.set(key, { name, tasks: [] });
    byUser.get(key).tasks.push(task);
  }

  for (const { name, tasks: userTasks } of byUser.values()) {
    const block = document.createElement("div");
    block.className = "tasks-user-block";
    // No h3 name header: the dropdown already indicates the selected responsible user (avoids duplicate label)
    for (const task of userTasks) {
      block.appendChild(createTaskRow(task));
    }
    root.appendChild(block);
  }
}

const groupCardObservers = new Map();
const observerBatch = new Map(); // groupId -> Set(oppIds)
let observerFlushTimeout = null;
const oppCustomFieldEnrich = {
  queue: [],
  inFlight: new Set(),
  pending: new Set(),
};

function opportunityHasCustomFieldLists(opp) {
  const lists = [
    opp.customFields,
    opp.CustomFields,
    opp.customFieldList,
    opp.CustomFieldList,
    opp.fieldValues,
    opp.FieldValues,
  ];
  return lists.some((l) => Array.isArray(l) && l.length);
}

function flushObserverBatch() {
  observerFlushTimeout = null;
  for (const [groupId, oppIds] of observerBatch) {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) continue;
    for (const oppId of oppIds) {
      const opp = findOpportunityInGroup(group, oppId);
      if (opp) enqueueOpportunityCustomFieldEnrich(opp, group);
    }
  }
  observerBatch.clear();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Disconnect all observers to prevent a burst of callbacks when the tab returns
    for (const entry of groupCardObservers.values()) {
      entry.observer.disconnect();
    }
    groupCardObservers.clear();
  } else {
    // Re-observe after a short delay to let the browser settle
    setTimeout(() => {
      for (const group of state.groups) {
        if (group._el && !tileBodyCollapsed(`group-${group.id}`)) {
          observeOpportunityCardsInGroup(group);
        }
      }
    }, 500);
  }
});

function findOpportunityInGroup(group, oppId) {
  const id = String(oppId);
  return (group.opportunities || []).find((o) => String(o.id ?? o.ID) === id) || null;
}

async function fetchOpportunityCustomFields(opp) {
  const id = opp.id ?? opp.ID;
  if (id == null) return false;
  const paths = [
    `/api/2.0/crm/opportunity/${id}/customfield`,
    `/api/2.0/crm/opportunity/${id}/customfields`,
    `/api/2.0/crm/opportunity/${id}/customfield/`,
  ];
  for (const path of paths) {
    try {
      const fields = unwrap(await api(path));
      if (fields.length) {
        opp.customFields = fields;
        state.oppCustomFieldCache?.set(id, fields);
        indexOpportunity(opp);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

function updateOpportunityCardDom(opp, group) {
  const root = group._el;
  if (!root) return;
  const card = root.querySelector(`.card[data-opportunity-id="${opp.id}"]`);
  if (!card) return;
  const showStagePill = group.groupBy !== "stage";
  const next = renderCard(opp, group, showStagePill);
  card.replaceWith(next);
  const board = $(".board", root);
  const entry = groupCardObservers.get(group.id);
  if (board && entry?.observer) entry.observer.observe(next);
}

function moveCardToStageColumn(oppId, stageId, boardEl) {
  if (!boardEl) return;
  const card = boardEl.querySelector(`.card[data-opportunity-id="${oppId}"]`);
  if (!card) return;
  const colBody = boardEl.querySelector(`.column[data-stage-id="${stageId}"] .column-body`);
  if (!colBody) return;
  colBody.appendChild(card);
}

async function drainOppCustomFieldEnrichQueue() {
  while (
    oppCustomFieldEnrich.queue.length > 0 &&
    oppCustomFieldEnrich.inFlight.size < OPP_CUSTOM_FIELD_ENRICH_CONCURRENCY
  ) {
    const job = oppCustomFieldEnrich.queue.shift();
    if (!job) break;
    const opp = job.opp;
    const group = job.group;
    const id = String(opp.id ?? opp.ID);
    if (!id || opportunityHasCustomFieldLists(opp)) {
      oppCustomFieldEnrich.pending.delete(id);
      continue;
    }
    oppCustomFieldEnrich.inFlight.add(id);
    try {
      await fetchOpportunityCustomFields(opp);
      updateOpportunityCardDom(opp, group);
    } catch {
      /* card keeps base fields */
    } finally {
      oppCustomFieldEnrich.inFlight.delete(id);
      oppCustomFieldEnrich.pending.delete(id);
    }
  }
}

function enqueueOpportunityCustomFieldEnrich(opp, group) {
  if (document.visibilityState === 'hidden') return;
  const id = String(opp.id ?? opp.ID);
  if (!id || !group) return;
  if (opportunityHasCustomFieldLists(opp)) return;
  if (oppCustomFieldEnrich.pending.has(id) || oppCustomFieldEnrich.inFlight.has(id)) return;
  // Check cache before queueing
  const cached = state.oppCustomFieldCache?.get(id);
  if (cached) {
    opp.customFields = cached;
    updateOpportunityCardDom(opp, group);
    return;
  }
  oppCustomFieldEnrich.pending.add(id);
  oppCustomFieldEnrich.queue.push({ opp, group });
  drainOppCustomFieldEnrichQueue();
}

function disconnectGroupCardObserver(groupId) {
  const entry = groupCardObservers.get(groupId);
  if (!entry) return;
  entry.observer.disconnect();
  groupCardObservers.delete(groupId);
}

function observeOpportunityCardsInGroup(group) {
  disconnectGroupCardObserver(group.id);
  const board = group._el?.querySelector(".board");
  if (!board) return;

  const tileRoot = group._el?.closest(".dashboard-tile") || null;
  const observer = new IntersectionObserver(
    (entries) => {
      if (document.visibilityState === 'hidden') return;
      let hasNew = false;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        const oppId = card.dataset.opportunityId;
        if (!oppId) continue;
        let set = observerBatch.get(group.id);
        if (!set) {
          set = new Set();
          observerBatch.set(group.id, set);
        }
        if (!set.has(oppId)) {
          set.add(oppId);
          hasNew = true;
        }
      }
      if (hasNew) {
        if (observerFlushTimeout) clearTimeout(observerFlushTimeout);
        observerFlushTimeout = setTimeout(flushObserverBatch, 50);
      }
    },
    { root: tileRoot, rootMargin: "160px 0px", threshold: 0.02 }
  );

  for (const card of board.querySelectorAll(".card[data-opportunity-id]")) {
    observer.observe(card);
  }
  groupCardObservers.set(group.id, { observer });
}

/** Legacy batch enrich — prefer visible-card queue; kept for explicit bulk refresh if needed. */
async function enrichOpportunitiesCustomFields(items) {
  if (!items.length || !state.customFieldDefs.length) return items;
  const missing = items.filter((o) => !opportunityHasCustomFieldLists(o));
  await Promise.all(
    missing.slice(0, 40).map((opp) => fetchOpportunityCustomFields(opp))
  );
  return items;
}

async function refreshGroup(group, { force = false } = {}) {
  const tileId = `group-${group.id}`;
  if (!force && tileBodyCollapsed(tileId)) {
    showTileCollapsedHint(tileId, "Minimized — expand to load deals");
    return;
  }
  // On a manual force-refresh, clear the filter result cache for this group so
  // we always fetch fresh data from the CRM (not a 30-second stale cached response).
  if (force) {
    const baseQs = buildFilterQuery(group);
    const cacheKey = `${group.id}::${baseQs}`;
    state.filterResultCache?.delete(cacheKey);
  }
  // Show tile-level loading indicator after 200ms (avoids flash on fast/cached refreshes)
  let loadingTimer;
  const boardEl = (() => {
    const e = groupDomEl(group);
    return e ? $(".board", e) : null;
  })();
  if (boardEl) {
    loadingTimer = setTimeout(() => {
      boardEl.innerHTML = '<div class="tile-loading"><span class="tile-loading-spinner"></span> Refreshing deals\u2026</div>';
    }, 200);
  }
  try {
    let items = await fetchOpportunitiesForGroup(group);
    clearTimeout(loadingTimer);
    if (group.dealStatus !== "all" && !group.stageType) {
      items = applyClientDealStatus(items, group.dealStatus);
    }
    group.opportunities = items;
    for (const o of items) indexOpportunity(o);

    // Defer DOM render so it doesn't block caller or freeze the UI
    setTimeout(() => {
      const el = groupDomEl(group);
      if (el) {
        updateGroupFilterSummary(group);
        renderGroupBoard(group, $(".board", el));
        $(".board-group-count", el).textContent = `${items.length} deals`;
      }
    }, 0);
  } catch (err) {
    clearTimeout(loadingTimer);
    const el = groupDomEl(group);
    if (el) {
      $(".board", el).innerHTML = `<p class="board-error">${escapeHtml(err.message)}</p>`;
    }
  }
}

let _crmRefreshing = false;

async function refreshAll() {
  _crmRefreshing = true;
  const refreshBtn = $("#refresh-btn");
  if (refreshBtn) refreshBtn.classList.add("refresh-btn-loading");
  try {
    noteDashboardActivity();
    $("#status-text").textContent = "Refreshing…";
    showCRMSyncStatus("Loading CRM data…");
    state.opportunityById = new Map();
    state.oppTagCache = state.oppTagCache || createOppCache(OPP_TAG_CACHE_TTL_MS);
    state.oppTagCache.clear();
    state.oppCustomFieldCache = state.oppCustomFieldCache || createOppCache(OPP_CUSTOM_FIELD_CACHE_TTL_MS);
    state.oppCustomFieldCache.clear();
    state.filterResultCache = state.filterResultCache || createTtlCache(FILTER_RESULT_CACHE_TTL_MS);
    state.filterResultCache.clear();
    state.tileLayout = loadLayoutFromStorage();
    // Use allSettled so tiles can still render even if some CRM loads fail (e.g. during crash).
    // CRM-dependent loads will have empty state; banner will be shown by api/presence catches.
    const settled = await Promise.allSettled([
      loadCurrentUser(),
      loadPortalUsers(),
      loadUserProfileFromServer(),
      loadStages(),
      loadAllTags(),
      loadOpportunityCustomFieldDefs(),
    ]);
    let hadNonTransientError = false;
    for (const r of settled) {
      if (r.status === "rejected") {
        if (!isTransientError(r.reason)) {
          hadNonTransientError = true;
          try { showToast(r.reason && r.reason.message ? r.reason.message : "Load error", true); } catch {}
        } else {
          showCrmCrashBanner();
        }
      }
    }
    syncFeedFilterPlaceholder();
    // Re-render bookmark sidebar + button states now that profile (including bookmarkedDeals) is loaded
    renderBookmarkTabs();
    refreshAllBookmarkButtonStates();
    renderBoardGroups();
    refreshDashboardTileLayouts();
    populateTasksUserFilter();
    // Fire CRM tile loads as background — the loading indicator stays visible
    // until they complete, but the dashboard renders immediately.
    const done = () => {
      _crmRefreshing = false;
      if (refreshBtn) refreshBtn.classList.remove("refresh-btn-loading");
      hideCRMSyncStatus();
    };
    loadExpandedDashboardTiles({ quiet: true }).then(done, done);
    if (hadNonTransientError) {
      $("#status-text").textContent = "Error";
    }
  } catch (e) {
    // Ensure refreshing state is cleared on unexpected errors in the config-load phase
    _crmRefreshing = false;
    if (refreshBtn) refreshBtn.classList.remove("refresh-btn-loading");
    hideCRMSyncStatus();
    throw e;
  }
}

function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#portal-label").textContent = state.portalUrl;
  renderDailyFocus();
  noteDashboardActivity();
  startPanelTileAutoRefresh();
  // Load mail dashboard read IDs from localStorage for session survival
  // No periodic global unreachable poller (removed per request to avoid spurious "unreachable" indicators during normal use).
  // The marquee / status only appears for actual queued/stale push failures.
}

function showLogin() {
  stopPanelTileAutoRefresh();
  if (presenceHeaderPollTimer) { clearInterval(presenceHeaderPollTimer); presenceHeaderPollTimer = null; }
  userProfileReady = false;
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
  $("#portal-url").value = state.portalUrl || DEFAULT_PORTAL;
}

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const saved = localStorage.getItem(DAILY_FOCUS_RANDOM_KEY);
    if (saved) {
      const { day: savedDay, index } = JSON.parse(saved);
      if (savedDay === day) return DAILY_QUOTES[index % DAILY_QUOTES.length];
    }
  } catch {}
  return DAILY_QUOTES[day % DAILY_QUOTES.length];
}

function refreshDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  const index = Math.floor(Math.random() * DAILY_QUOTES.length);
  try { localStorage.setItem(DAILY_FOCUS_RANDOM_KEY, JSON.stringify({ day, index })); } catch {}
  renderDailyFocus();
}

function renderDailyFocus() {
  const container = $("#daily-focus");
  if (!container) return;
  const q = getDailyQuote();
  container.innerHTML = "";
  const quote = document.createElement("span");
  quote.className = "daily-focus-quote";
  quote.textContent = `"${q.text}"`;
  const author = document.createElement("span");
  author.className = "daily-focus-author";
  author.textContent = `— ${q.author}`;
  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "daily-focus-refresh";
  refreshBtn.title = "New quote";
  refreshBtn.textContent = "↻";
  refreshBtn.addEventListener("click", () => refreshDailyQuote());
  container.appendChild(quote);
  container.appendChild(document.createTextNode(" "));
  container.appendChild(author);
  container.appendChild(document.createTextNode(" "));
  container.appendChild(refreshBtn);
}

async function checkSession() {
  return (await (await fetch("/api/session", { credentials: "same-origin" })).json()).authenticated;
}

// --- Changelog modal ---
const CHANGELOG_SEEN_KEY = "changelog_seen_version";

async function showChangelogModal(version) {
  const modal = $("#changelog-modal");
  const body = $("#changelog-body");
  const verLabel = $("#changelog-version");
  if (!modal || !body) return;

  verLabel.textContent = version ? `v${version}` : "";
  body.innerHTML = '<p class="opp-preview-loading">Loading changelog…</p>';
  modal.classList.remove("hidden");

  try {
    const res = await fetch("/api/changelog", { credentials: "same-origin" });
    const text = await res.text();
    body.innerHTML = renderBasicMarkdown(text);
  } catch (err) {
    body.innerHTML = `<p class="opp-preview-error">Could not load changelog: ${escapeHtml(err.message)}</p>`;
  }
}

function closeChangelogModal(version) {
  const modal = $("#changelog-modal");
  if (modal) modal.classList.add("hidden");
  if (version) {
    localStorage.setItem(CHANGELOG_SEEN_KEY, String(version));
  }
}

function maybeShowChangelog(version) {
  if (!version) return;
  const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
  if (seen === String(version)) return;
  // Defer slightly so the dashboard shell paints first
  setTimeout(() => {
    showChangelogModal(version);
  }, 300);
}

function bindChangelogModal(version) {
  const modal = $("#changelog-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  $("#changelog-close")?.addEventListener("click", () => closeChangelogModal(version));
  modal.querySelectorAll("[data-changelog-dismiss]").forEach((el) => {
    el.addEventListener("click", () => closeChangelogModal(version));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeChangelogModal(version);
    }
  });
}

async function init() {
  // Load any previously queued CRM mutations (survives reload / offline periods).
  loadMutationQueue();
  updateMutationSyncStatus();

  const config = await (await fetch("/api/config")).json();
  if (config.portalUrl) {
    state.portalUrl = config.portalUrl;
    localStorage.setItem("oo_portal_url", state.portalUrl);
  }
  // Version next to sign out (loaded from server /VERSION so it auto-updates on release)
  const verEl = $("#app-version");
  if (verEl) verEl.textContent = config.version ? "v" + config.version : "v1.7.5";

  state.groups = [];
  state.calendarTiles = [];
  state.notesTiles = [];
  state.tileLayout = { order: [], widths: {}, heights: {}, collapsed: {} };
  state.hiddenFeedEntries = new Map();
  state.groupTemplates = [];
  userProfileReady = false;
  bindNewTaskModal();
  bindDealEditModal();
  bindQuickNoteModal();
  bindCreateOpportunityModal();
  bindGlobalOpportunitySearch();
  bindOpportunityPreviewModal();
  bindSearchPopupBtn();
  bindSearchPopupModal();
  bindDMPopup();
  bindMessagesPopup();
  bindDashboardActivityTracking();
  bindFeedHiddenModal();
  bindNotesArchiveRestoreModal();
  initBookmarkSidebar();

  $("#new-opportunity-btn")?.addEventListener("click", () => {
    openCreateOpportunityModal().catch((err) => showToast(err.message, true));
  });

  $("#quick-note-btn")?.addEventListener("click", () => {
    openQuickNoteModal().catch((err) => showToast(err.message, true));
  });

  bindAddTileModal();
  bindCalendarEventModal();
  bindMailInboxButton();

  $("#refresh-btn").addEventListener("click", refreshAll);
  $("#logout-btn").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    // Clean presence cache on explicit logout (the "until next login" contract)
    try { clearPresenceUsersCache(); } catch {}
    showLogin();
  });

  // Mutation queue lifecycle wiring (client-side only, per plan)
  window.addEventListener("online", () => {
    processMutationQueue().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      processMutationQueue().catch(() => {});
    }
  });
  // Background safety net (the guard + online check inside process make this cheap)
  setInterval(() => {
    processMutationQueue().catch(() => {});
  }, RETRY_INTERVAL_MS);

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#login-error");
    const loadingEl = $("#login-loading");
    const submitBtn = $("#login-submit-btn");
    errEl.classList.add("hidden");
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in…";
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          portalUrl: $("#portal-url").value.trim().replace(/\/$/, ""),
          userName: $("#username").value,
          password: $("#password").value,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Login failed");
      state.portalUrl = data.portalUrl || $("#portal-url").value.trim();
      localStorage.setItem("oo_portal_url", state.portalUrl);
      showApp();
      // Start presence (bind button, heartbeats for self-online, snapshot for indicators/badge) immediately.
      // This makes the header icon show indicators right away, and button responsive without waiting for refreshAll.
      try { ensurePresenceOnLogin(); } catch {}
      bindChangelogModal(config.version);
      maybeShowChangelog(config.version);
      // Defer refreshAll to let the browser paint the app shell first.
      setTimeout(async () => {
        await initCaches();
        await refreshAll();
        try { ensurePresenceOnLogin(); } catch {}
        loadTaskCategories({ force: true }).catch(() => {});
        processMutationQueue().catch(() => {});
      }, 0);
    } catch (err) {
      clearTimeout(timeoutId);
      let msg = err.message || "Login failed";
      if (err.name === "AbortError" || /aborted|timeout/i.test(msg)) {
        msg = "Server unreachable, contact admin";
      }
      errEl.textContent = msg;
      errEl.classList.remove("hidden");
    } finally {
      if (loadingEl) loadingEl.classList.add("hidden");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign in";
      }
    }
  });

  // Show the correct screen immediately (paints login or app shell before heavy work).
  if (await checkSession()) {
    showApp();
    // Start presence so header icon gets indicators right away.
    try { ensurePresenceOnLogin(); } catch {}
    bindChangelogModal(config.version);
    maybeShowChangelog(config.version);
    // Defer refreshAll + post-refresh setup to the next task so the browser paints first.
    // This reduces FCP/LCP blocking and helps TBT by moving heavy CRM renders off the critical path.
    setTimeout(async () => {
      await initCaches();
      await refreshAll();
      try { ensurePresenceOnLogin(); } catch {}
      loadTaskCategories({ force: false }).catch(() => {});
      processMutationQueue().catch(() => {});
    }, 0);
  } else {
    showLogin();
  }
}

init();

// Formatting toolbar for quick event note and deal-edit (preview) event note editors.
// Single light-green highlighter using <mark> (clean markup, no triggering mail heuristics in preview).
// CSS applies the readable low-opacity tint (copied from notes-tile mark fix).
document.addEventListener("click", function (e) {
  const btn = e.target.closest(".note-format-btn");
  if (!btn) return;
  const toolbar = btn.closest(".note-format-toolbar");
  if (!toolbar) return;
  const editor = toolbar.parentElement && toolbar.parentElement.querySelector(".note-editor");
  if (!editor) return;
  e.preventDefault();
  editor.focus();
  const cmd = btn.dataset.cmd;
  const val = btn.dataset.val || null;
  if (!cmd) return;
  if (cmd === "hiliteColor" || cmd === "backColor") {
    // Single light green; CSS below forces the low-opacity readable version (notes-tile style)
    // so it doesn't wash out text. Using execCommand for stable selection handling (no extra breaks/spaces).
    document.execCommand("hiliteColor", false, "#c8e6c9");
  } else {
    document.execCommand(cmd, false, val);
  }
});

// Safety net: if *both* login and app screens are still hidden long after load
// (e.g. early JS error or init never reached a showApp/showLogin decision),
// force the login screen visible. Do *not* fight a real async login/restore that
// has already called showApp (even if refreshAll is still loading data).
setTimeout(() => {
  try {
    var login = document.getElementById('login-screen');
    var appEl = document.getElementById('app');
    const bothHidden = !!(login && login.classList && login.classList.contains('hidden') &&
                          appEl && appEl.classList && appEl.classList.contains('hidden'));
    if (bothHidden) {
      console.warn('[dashboard] Both screens still hidden after init; forcing login UI visible as fallback.');
      if (typeof showLogin === 'function') {
        showLogin();
      } else if (login) {
        login.classList.remove('hidden');
        if (appEl) appEl.classList.add('hidden');
      }
    }
  } catch (e) {
    // Last resort - pure vanilla
    try {
      document.body.innerHTML = '<div style="padding:2rem;font-family:sans-serif"><h1>Dashboard failed to load</h1><p>Server may be unreachable or there is a JS error. Check console (F12) and contact admin. <button onclick="location.reload()">Reload</button></p></div>';
    } catch(_) {}
  }
}, 4000);