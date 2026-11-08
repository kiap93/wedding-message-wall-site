import { createDefaultWebsiteConfig, WEBSITE_TEMPLATES } from '../src/website-builder/presets';
import { useWebsiteStore } from '../src/website-builder/store/websiteStore';
import { WeddingEvent } from '../src/types';

function runTests() {
  console.log('🧪 Starting Website Studio Workspace Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const mockProject: WeddingEvent = {
    id: 'test-event-1',
    agency_id: 'agency-1',
    name: 'Julian & Claire Wedding',
    slug: 'julian-claire',
    groom_name: 'Julian',
    bride_name: 'Claire',
    wedding_date: '2025-10-18',
    location: 'Napa Valley, CA',
    theme_id: 'garden',
    image_url: 'https://images.unsplash.com/photo-wedding-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // TEST GROUP 1: Default Website Configuration
  console.log('--- Test Group 1: Default Configuration Generation ---');
  const defaultConfig = createDefaultWebsiteConfig(mockProject);

  assert(Array.isArray(defaultConfig.sections), 'Generated config has sections array');
  assert(defaultConfig.sections.length === 10, `Generated exactly 10 initial sections (got ${defaultConfig.sections.length})`);
  
  const expectedTypes = ['hero', 'countdown', 'story', 'schedule', 'venue', 'gallery', 'invitation', 'rsvp', 'wall', 'footer'];
  const actualTypes = defaultConfig.sections.map(s => s.type);
  const allTypesPresent = expectedTypes.every(t => actualTypes.includes(t as any));
  assert(allTypesPresent, 'All 10 required section types are present in initial config');

  const heroSection = defaultConfig.sections.find(s => s.type === 'hero');
  assert(
    heroSection?.content?.headline?.includes('Julian & Claire'),
    'Hero section headline defaults to groom & bride names'
  );

  const venueSection = defaultConfig.sections.find(s => s.type === 'venue');
  assert(
    venueSection?.content?.venueName?.includes('Napa Valley') || venueSection?.content?.address?.includes('Napa Valley'),
    'Venue section defaults to project location'
  );

  // TEST GROUP 2: Store State & Initialization
  console.log('\n--- Test Group 2: Store State & Initialization ---');
  useWebsiteStore.getState().init(mockProject);
  let state = useWebsiteStore.getState();

  assert(state.project?.id === 'test-event-1', 'Store initialized with mock project');
  assert(state.config.sections.length === 10, 'Store initialized with 10 sections');
  assert(state.selectedSectionId === 'sec-hero', 'Selected section defaults to first section');
  assert(state.deviceMode === 'desktop', 'Default device mode is desktop');
  assert(state.zoom === 100, 'Default zoom is 100%');

  // TEST GROUP 3: Section Actions (Add, Remove, Toggle, Move)
  console.log('\n--- Test Group 3: Section Mutations ---');
  // 3.1 Toggle visibility
  useWebsiteStore.getState().toggleSectionVisibility('sec-countdown');
  state = useWebsiteStore.getState();
  const countdownSec = state.config.sections.find(s => s.id === 'sec-countdown');
  assert(countdownSec?.enabled === false, 'Toggling visibility disabled countdown section');

  // 3.2 Add section
  useWebsiteStore.getState().addSection('story');
  state = useWebsiteStore.getState();
  assert(state.config.sections.length === 11, 'Adding a section increases section count to 11');
  const addedSection = state.config.sections[state.config.sections.length - 1];
  assert(addedSection.type === 'story', 'Newly added section has correct type');

  // 3.3 Move section
  const firstId = state.config.sections[0].id;
  const secondId = state.config.sections[1].id;
  useWebsiteStore.getState().moveSection(secondId, 'up');
  state = useWebsiteStore.getState();
  assert(state.config.sections[0].id === secondId, 'Moving second section up places it at index 0');
  assert(state.config.sections[1].id === firstId, 'First section shifted to index 1');

  // 3.4 Remove section
  useWebsiteStore.getState().removeSection(addedSection.id);
  state = useWebsiteStore.getState();
  assert(state.config.sections.length === 10, 'Removing added section restores count to 10');

  // TEST GROUP 4: Template Presets Application
  console.log('\n--- Test Group 4: Templates & Design Tokens ---');
  assert(WEBSITE_TEMPLATES.length >= 5, `At least 5 curated templates exist (got ${WEBSITE_TEMPLATES.length})`);
  
  useWebsiteStore.getState().applyTemplatePreset('vintage_editorial');
  state = useWebsiteStore.getState();
  assert(state.config.design.themeId === 'vintage_editorial', 'Applied vintage_editorial themeId');
  assert(state.config.design.typography.headingFont === 'Italiana', 'Applied vintage_editorial heading font');
  assert(state.config.sections.length === 10, 'Sections count and content preserved across template change');

  // TEST GROUP 5: Undo / Redo Mechanism
  console.log('\n--- Test Group 5: Undo & Redo History ---');
  assert(useWebsiteStore.getState().canUndo(), 'canUndo returns true after state mutations');
  
  // Undo template application
  useWebsiteStore.getState().undo();
  state = useWebsiteStore.getState();
  assert(state.config.design.themeId === 'garden', 'Undo successfully reverted template application back to garden');

  // Redo template application
  useWebsiteStore.getState().redo();
  state = useWebsiteStore.getState();
  assert(state.config.design.themeId === 'vintage_editorial', 'Redo successfully re-applied vintage_editorial template');

  // Add section and undo
  useWebsiteStore.getState().addSection('gallery');
  assert(useWebsiteStore.getState().config.sections.length === 11, 'Added section (count 11)');
  useWebsiteStore.getState().undo();
  // TEST GROUP 6: Phase 3 Drag-and-Drop & Section Items Management
  console.log('\n--- Test Group 6: Phase 3 Drag-and-Drop & Item-Level Editors ---');
  // 6.1 Reorder sections via drag-and-drop
  const initialZeroId = useWebsiteStore.getState().config.sections[0].id;
  const initialThirdId = useWebsiteStore.getState().config.sections[3].id;
  useWebsiteStore.getState().reorderSections(0, 3);
  state = useWebsiteStore.getState();
  assert(state.config.sections[3].id === initialZeroId, 'reorderSections(0, 3) moved index 0 to index 3');
  assert(state.config.sections.length === 10, 'Section count preserved during drag-and-drop reorder');

  // 6.2 Story Milestones
  const storySection = state.config.sections.find(s => s.type === 'story')!;
  const initialMilestonesCount = storySection.content?.milestones?.length || 0;
  useWebsiteStore.getState().addStoryMilestone(storySection.id);
  state = useWebsiteStore.getState();
  const updatedStory = state.config.sections.find(s => s.id === storySection.id)!;
  const newMilestones = updatedStory.content?.milestones || [];
  assert(newMilestones.length === initialMilestonesCount + 1, 'addStoryMilestone added a milestone');
  const addedMilestone = newMilestones[newMilestones.length - 1];
  
  useWebsiteStore.getState().updateStoryMilestone(storySection.id, addedMilestone.id, {
    title: 'Paris Proposal',
    year: '2024'
  });
  state = useWebsiteStore.getState();
  const modifiedMilestone = state.config.sections.find(s => s.id === storySection.id)?.content?.milestones?.find(m => m.id === addedMilestone.id);
  assert(modifiedMilestone?.title === 'Paris Proposal', 'updateStoryMilestone updated milestone title');
  assert(modifiedMilestone?.year === '2024', 'updateStoryMilestone updated milestone year');

  useWebsiteStore.getState().removeStoryMilestone(storySection.id, addedMilestone.id);
  state = useWebsiteStore.getState();
  const finalMilestones = state.config.sections.find(s => s.id === storySection.id)?.content?.milestones || [];
  assert(finalMilestones.length === initialMilestonesCount, 'removeStoryMilestone removed the milestone');

  // 6.3 Schedule Events
  const scheduleSection = state.config.sections.find(s => s.type === 'schedule')!;
  const initialEventsCount = scheduleSection.content?.events?.length || 0;
  useWebsiteStore.getState().addScheduleEvent(scheduleSection.id);
  state = useWebsiteStore.getState();
  const updatedSchedule = state.config.sections.find(s => s.id === scheduleSection.id)!;
  const newEvents = updatedSchedule.content?.events || [];
  assert(newEvents.length === initialEventsCount + 1, 'addScheduleEvent added an itinerary event');
  const addedEvent = newEvents[newEvents.length - 1];

  useWebsiteStore.getState().updateScheduleEvent(scheduleSection.id, addedEvent.id, {
    time: '6:30 PM',
    title: 'Sunset Fireworks'
  });
  state = useWebsiteStore.getState();
  const modifiedEvent = state.config.sections.find(s => s.id === scheduleSection.id)?.content?.events?.find(e => e.id === addedEvent.id);
  assert(modifiedEvent?.time === '6:30 PM', 'updateScheduleEvent updated event time');
  assert(modifiedEvent?.title === 'Sunset Fireworks', 'updateScheduleEvent updated event title');

  useWebsiteStore.getState().removeScheduleEvent(scheduleSection.id, addedEvent.id);
  state = useWebsiteStore.getState();
  const finalEvents = state.config.sections.find(s => s.id === scheduleSection.id)?.content?.events || [];
  assert(finalEvents.length === initialEventsCount, 'removeScheduleEvent removed the itinerary event');

  // 6.4 Gallery Photos
  const gallerySection = state.config.sections.find(s => s.type === 'gallery')!;
  const initialPhotosCount = gallerySection.content?.photos?.length || 0;
  useWebsiteStore.getState().addGalleryPhoto(gallerySection.id, 'https://example.com/photo.jpg', 'Golden Hour');
  state = useWebsiteStore.getState();
  const updatedGallery = state.config.sections.find(s => s.id === gallerySection.id)!;
  const newPhotos = updatedGallery.content?.photos || [];
  assert(newPhotos.length === initialPhotosCount + 1, 'addGalleryPhoto added a photo');
  const addedPhoto = newPhotos[newPhotos.length - 1];

  useWebsiteStore.getState().updateGalleryPhoto(gallerySection.id, addedPhoto.id, {
    caption: 'Sunset in Napa'
  });
  state = useWebsiteStore.getState();
  const modifiedPhoto = state.config.sections.find(s => s.id === gallerySection.id)?.content?.photos?.find(p => p.id === addedPhoto.id);
  assert(modifiedPhoto?.caption === 'Sunset in Napa', 'updateGalleryPhoto updated photo caption');

  useWebsiteStore.getState().removeGalleryPhoto(gallerySection.id, addedPhoto.id);
  state = useWebsiteStore.getState();
  const finalPhotos = state.config.sections.find(s => s.id === gallerySection.id)?.content?.photos || [];
  assert(finalPhotos.length === initialPhotosCount, 'removeGalleryPhoto removed the photo');

  console.log(`\n================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
