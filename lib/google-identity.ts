/**
 * Browser-only helpers shared by the Google Photos and Google Drive import
 * buttons (features/uploads/components/google-photos-button.tsx,
 * google-drive-button.tsx): loading Google's scripts and getting a
 * short-lived access token from Google Identity Services. The token stays
 * in memory for one import; nothing is stored and no EveryMoment account
 * is involved.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }): { requestAccessToken(options?: { prompt?: string }): void };
}

/** The slice of the Google Picker API the Drive button uses. */
export interface PickerDocument {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number | string;
}
export interface PickerResponse {
  action: string;
  docs?: PickerDocument[];
}
interface PickerView {
  setMimeTypes(mimeTypes: string): PickerView;
  setIncludeFolders(include: boolean): PickerView;
}
interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setMaxItems(max: number): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}
export interface GooglePickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId?: string) => PickerView;
  ViewId: { DOCS: string; DOCS_IMAGES: string; DOCS_IMAGES_AND_VIDEOS: string };
  Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
  Action: { PICKED: string; CANCEL: string };
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOauth2 }; picker?: GooglePickerNamespace };
    gapi?: { load(name: string, callback: () => void): void };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Google. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

let gisLoading: Promise<void> | null = null;
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= loadScript(GIS_SRC).catch((err: unknown) => {
    gisLoading = null;
    throw err;
  });
  return gisLoading;
}

let pickerLoading: Promise<GooglePickerNamespace> | null = null;
/** Google's Picker UI (used for Drive) — gapi first, then its "picker" module. */
export function loadGooglePicker(): Promise<GooglePickerNamespace> {
  if (window.google?.picker) return Promise.resolve(window.google.picker);
  pickerLoading ??= (window.gapi ? Promise.resolve() : loadScript(GAPI_SRC))
    .then(
      () =>
        new Promise<GooglePickerNamespace>((resolve, reject) => {
          window.gapi!.load("picker", () =>
            window.google?.picker ? resolve(window.google.picker) : reject(new Error("Google Drive didn't load.")),
          );
        }),
    )
    .catch((err: unknown) => {
      pickerLoading = null;
      throw err;
    });
  return pickerLoading;
}

/** Opens Google's sign-in popup for `scope` and resolves with an access token. Call straight from a tap. */
export async function requestGoogleToken(clientId: string, scope: string): Promise<string> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in didn't load.");
  return new Promise<string>((resolve, reject) => {
    oauth2
      .initTokenClient({
        client_id: clientId,
        scope,
        callback: (r) =>
          r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description ?? r.error ?? "Google sign-in was cancelled.")),
        error_callback: (e) =>
          reject(new Error(e.type === "popup_closed" ? "Google sign-in was closed." : e.message ?? "Google sign-in failed.")),
      })
      .requestAccessToken();
  });
}
