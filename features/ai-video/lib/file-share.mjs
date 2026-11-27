// Call during the click itself: a delayed export would lose browser activation.
// File-only data prevents apps from receiving an invitation title as a message.
export function shareDownloadedFile(file, api = globalThis.navigator) {
    if (!file || !api?.share || !api?.canShare) return null;
    const data = { files: [file] };
    if (!api.canShare(data)) return null;
    return api.share(data);
}
