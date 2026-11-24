"use client";
import { useState } from "react";
import { shareDownloadedFile } from "@/features/ai-video/lib/file-share.mjs";
import { download } from "@/features/ai-video/components/ui-helpers";

function WhatsAppIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a9.8 9.8 0 0 0-8.4 14.9L2.5 21.5l4.8-1.1A9.8 9.8 0 1 0 12 2Zm0 17.8a8 8 0 0 1-4.1-1.2l-.3-.2-2.8.7.8-2.7-.2-.3A8 8 0 1 1 12 19.8Zm4.4-5.9c-.2-.1-1.3-.6-1.5-.7s-.4-.1-.5.1-.6.7-.7.8-.3.2-.5.1a6.4 6.4 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.1-.2 0-.3.1-.5l.3-.3c.1-.1.2-.2.2-.4s0-.3-.1-.4l-.7-1.6c-.2-.4-.4-.3-.5-.3h-.4c-.2 0-.4.1-.6.3s-.8.8-.8 2 .8 2.2 1 2.5a9.1 9.1 0 0 0 3.5 3.2c.5.2.9.4 1.2.5.5.2 1 .2 1.4.1.4-.1 1.3-.5 1.5-1s.2-.9.1-1-.2-.2-.4-.3Z" /></svg>; }
function InstagramIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r=".8" fill="currentColor" stroke="none" /></svg>; }
function FacebookIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V4a22 22 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2H8v3h2.6v8h3.1Z" /></svg>; }


export default function SocialShareActions({ file, type = "invitation" }) {
    const [feedback, setFeedback] = useState("");
    const [sharing, setSharing] = useState(false);
    const [fallback, setFallback] = useState("");
    const targets = {
        WhatsApp: "https://web.whatsapp.com/",
        Instagram: "https://www.instagram.com/direct/inbox/",
        Facebook: "https://www.facebook.com/",
    };
    async function shareTo(platform) {
        if (sharing) return;
        setFeedback("");
        setFallback("");
        setSharing(true);
        try {
            const pending = shareDownloadedFile(file);
            if (!pending) {
                setFallback(platform);
                setFeedback(`This browser cannot attach files directly. Open ${platform} and attach ${file.name} from Downloads.`);
                return;
            }
            setFeedback(`Choose ${platform} from your device’s share menu to send this file.`);
            await pending;
        } catch (error) {
            if (error?.name === "AbortError") { setFeedback(""); return; }
            setFallback(platform);
            setFeedback(`The file could not be shared. Download it below and attach it in ${platform}.`);
        } finally { setSharing(false); }
    }
    if (!file) return null;
    return <section className="share" aria-label={`Share this ${type}`}>
      <h3 className="share-heading">Share your downloaded {type}</h3>
      <p className="hint small share-file-name">{file.name}</p>
      <div className="share-social" aria-label="Share downloaded file">
        <button type="button" disabled={sharing} className="share-platform whatsapp-share" onClick={() => shareTo("WhatsApp")} aria-label="Share on WhatsApp"><WhatsAppIcon /><span>WhatsApp</span></button>
        <button type="button" disabled={sharing} className="share-platform instagram-share" onClick={() => shareTo("Instagram")} aria-label="Share on Instagram"><InstagramIcon /><span>Instagram</span></button>
        <button type="button" disabled={sharing} className="share-platform facebook-share" onClick={() => shareTo("Facebook")} aria-label="Share on Facebook"><FacebookIcon /><span>Facebook</span></button>
      </div>
      {feedback && <p className="hint small share-feedback" role="status">{feedback}</p>}
      {fallback && <div className="two-buttons"><button type="button" onClick={() => download(file, file.name)}>Download file</button><a href={targets[fallback]} target="_blank" rel="noopener noreferrer">Open {fallback} ↗</a></div>}
    </section>;
}
