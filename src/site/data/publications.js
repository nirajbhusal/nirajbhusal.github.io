/**
 * Papers, magazine articles, and other publications.
 * The /publications/ page is generated from this array — add an object to list another piece.
 *
 * Optional fields (omit rather than guessing):
 *   date         Only when verified. Shown as written, e.g. "2 October 2026".
 *   issue        Issue number, without the word "Issue".
 *   issueTitle   Theme or title of that issue.
 *   publication  Preformatted venue line. If set, venue / issue / issueTitle are not used.
 *   pages        Page range, e.g. "65–67". Rendered as "pp. 65–67".
 *   url          External link. Opens in a new tab.
 *   linkLabel    Anchor text. Defaults to "Read".
 *   type         Badge. Defaults to "Publication".
 */
export const publications = [
  {
    type: 'Article',
    title: 'Government Services in Our Pocket: Building Nepal’s Digital Democracy',
    author: 'Niraj Bhusal',
    venue: 'NEFport',
    issue: '66',
    issueTitle: 'Digital Democracy: How Democracy Is Practiced in the Digital Age',
    // Verified on the Issuu document page: "Published on Oct 2, 2026".
    date: '2 October 2026',
    publisher: 'Nepal Economic Forum',
    pages: '65–67',
    url: 'https://issuu.com/nepaleconomicforum/docs/digital_democracy_how_democracy_is_practiced_in_t',
    linkLabel: 'Read on Issuu (pp. 65–67)',
    description:
      'An article on digital public services in Nepal, including citizen-app style government services people can reach from a phone, and how those services relate to digital democracy.',
  },
];
