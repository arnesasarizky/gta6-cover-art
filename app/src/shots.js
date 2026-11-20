// Fixed scenes for screenshots: ?shot=cover shows the finished cover full frame,
// ?shot=cover-tall the portrait cover, ?shot=editor the editor with a photo loaded,
// ?shot=grid the nine-panel cover. window.__shotReady is set once painted.
export async function runShot(shot, query, api) {
  const caption = query.get('caption');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    api.setSize('1920x1080');
    api.setLayout('hero-three');
    api.setGrade(query.get('grade') ?? 'sunset');
    api.setCaption(caption ?? 'Neon Coast');
    api.setSubtitle(query.get('subtitle') ?? 'Vice City nights');
    api.setBadge(query.get('badge') ?? 'Vice City');
    api.setHeat(Number(query.get('heat') ?? 4));
    api.setEffects(true, true);
    api.setSelectedPanel(null);
    await api.fillPanelsWithSamples();
  } else if (shot === 'cover-tall') {
    document.body.classList.add('shot-cover');
    api.setSize('1080x1350');
    api.setLayout('full-bleed');
    api.setGrade(query.get('grade') ?? 'neon');
    api.setCaption(caption ?? 'Pier Pressure');
    api.setSubtitle(query.get('subtitle') ?? 'chasing the last light');
    api.setBadge(query.get('badge') ?? 'Vice City');
    api.setHeat(Number(query.get('heat') ?? 5));
    api.setEffects(true, true);
    api.setSelectedPanel(null);
    await api.fillAllPanelsWithSample(query.get('photo') ?? 'pier');
  } else if (shot === 'grid') {
    document.body.classList.add('shot-cover');
    api.setSize('1920x1080');
    api.setLayout('grid-9');
    api.setGrade(query.get('grade') ?? 'vaporwave');
    api.setCaption(caption ?? 'Nine Lives');
    api.setSubtitle(query.get('subtitle') ?? 'one city, nine stories');
    api.setBadge(query.get('badge') ?? 'Vice City');
    api.setHeat(Number(query.get('heat') ?? 5));
    api.setEffects(true, true);
    api.setSelectedPanel(null);
    await api.fillPanelsWithSamples();
  } else {
    // editor: the page as a person sees it, sample photos already loaded.
    api.setSize('1920x1080');
    api.setLayout('hero-three');
    api.setGrade(query.get('grade') ?? 'sunset');
    api.setCaption(caption ?? 'Boulevard Queen');
    api.setSubtitle(query.get('subtitle') ?? 'Vice City nights');
    api.setBadge(query.get('badge') ?? 'Vice City');
    api.setHeat(Number(query.get('heat') ?? 4));
    api.setEffects(true, true);
    await api.fillPanelsWithSamples();
  }
  api.syncControls();
  api.redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
