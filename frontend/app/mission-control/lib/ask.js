/**
 * The words the owner's ask puts in front of the helpers, for the
 * browser. The server sends the same sentence with the picture
 * (holdAskText in app/lib/searchPicture.js); this copy lets the owner's
 * switch show it before it has gone out. __tests__/lib/searchWords.test.js
 * holds the two together.
 */
export function holdAskTextFor(petName) {
  return `Please stay back while I go to ${petName || 'the pet'}.`;
}
