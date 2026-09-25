/** Static configuration for the Netflix iOS FTL user API request. */

export const API_URL = "https://ios.prod.ftl.netflix.com/iosui/user/15.48";

export const COOKIE_KEYS = [
  "NetflixId",
  "SecureNetflixId",
  "nfvdid",
  "OptanonConsent",
] as const;

export const REQUIRED_COOKIE = "NetflixId";

const ESN =
  "NFAPPL-02-IPHONE8=1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200";

export const QUERY_PARAMS: Record<string, string> = {
  appVersion: "15.48.1",
  config: JSON.stringify({
    gamesInTrailersEnabled: "false",
    isTrailersEvidenceEnabled: "false",
    cdsMyListSortEnabled: "true",
    kidsBillboardEnabled: "true",
    addHorizontalBoxArtToVideoSummariesEnabled: "false",
    skOverlayTestEnabled: "false",
    homeFeedTestTVMovieListsEnabled: "false",
    baselineOnIpadEnabled: "true",
    trailersVideoIdLoggingFixEnabled: "true",
    postPlayPreviewsEnabled: "false",
    bypassContextualAssetsEnabled: "false",
    roarEnabled: "false",
    useSeason1AltLabelEnabled: "false",
    disableCDSSearchPaginationSectionKinds: ["searchVideoCarousel"],
    cdsSearchHorizontalPaginationEnabled: "true",
    searchPreQueryGamesEnabled: "true",
    kidsMyListEnabled: "true",
    billboardEnabled: "true",
    useCDSGalleryEnabled: "true",
    contentWarningEnabled: "true",
    videosInPopularGamesEnabled: "true",
    avifFormatEnabled: "false",
    sharksEnabled: "true",
  }),
  device_type: "NFAPPL-02-",
  esn: ESN,
  idiom: "phone",
  iosVersion: "15.8.5",
  isTablet: "false",
  languages: "en-US",
  locale: "en-US",
  maxDeviceWidth: "375",
  model: "saget",
  modelType: "IPHONE8-1",
  odpAware: "true",
  path: '["account","token","default"]',
  pathFormat: "graph",
  pixelDensity: "2.0",
  progressive: "false",
  responseFormat: "json",
};

export const BASE_HEADERS: Record<string, string> = {
  "User-Agent": "Argo/15.48.1 (iPhone; iOS 15.8.5; Scale/2.00)",
  "x-netflix.request.attempt": "1",
  "x-netflix.request.client.user.guid": "A4CS633D7VCBPE2GPK2HL4EKOE",
  "x-netflix.context.profile-guid": "A4CS633D7VCBPE2GPK2HL4EKOE",
  "x-netflix.request.routing":
    '{"path":"/nq/mobile/nqios/~15.48.0/user","control_tag":"iosui_argo"}',
  "x-netflix.context.app-version": "15.48.1",
  "x-netflix.argo.translated": "true",
  "x-netflix.context.form-factor": "phone",
  "x-netflix.context.sdk-version": "2012.4",
  "x-netflix.client.appversion": "15.48.1",
  "x-netflix.context.max-device-width": "375",
  "x-netflix.context.ab-tests": "",
  "x-netflix.tracing.cl.useractionid": "4DC655F2-9C3C-4343-8229-CA1B003C3053",
  "x-netflix.client.type": "argo",
  "x-netflix.client.ftl.esn": ESN,
  "x-netflix.context.locales": "en-US",
  "x-netflix.context.top-level-uuid": "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
  "x-netflix.client.iosversion": "15.8.5",
  "accept-language": "en-US;q=1",
  "x-netflix.argo.abtests": "",
  "x-netflix.context.os-version": "15.8.5",
  "x-netflix.request.client.context": '{"appState":"foreground"}',
  "x-netflix.context.ui-flavor": "argo",
  "x-netflix.argo.nfnsm": "9",
  "x-netflix.context.pixel-density": "2.0",
  "x-netflix.request.toplevel.uuid": "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
  "x-netflix.request.client.timezoneid": "Africa/Lagos",
};
