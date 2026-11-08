import React from 'react';
import { WebsiteSection, WebsiteDesignConfig } from '../types';
import { WeddingEvent } from '../../types';
import { HeroSection } from './HeroSection';
import { CountdownSection } from './CountdownSection';
import { StorySection } from './StorySection';
import { ScheduleSection } from './ScheduleSection';
import { VenueSection } from './VenueSection';
import { GallerySection } from './GallerySection';
import { InvitationSection } from './InvitationSection';
import { RSVPSection } from './RSVPSection';
import { WallSection } from './WallSection';
import { FooterSection } from './FooterSection';

interface SectionRendererProps {
  section: WebsiteSection;
  design: WebsiteDesignConfig;
  project: WeddingEvent | null;
  isEditor?: boolean;
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({
  section,
  design,
  project,
  isEditor = false
}) => {
  if (!section.enabled) return null;

  switch (section.type) {
    case 'hero':
      return <HeroSection section={section} design={design} project={project} isEditor={isEditor} />;
    case 'countdown':
      return <CountdownSection section={section} design={design} project={project} />;
    case 'story':
      return <StorySection section={section} design={design} project={project} />;
    case 'schedule':
      return <ScheduleSection section={section} design={design} project={project} />;
    case 'venue':
      return <VenueSection section={section} design={design} project={project} />;
    case 'gallery':
      return <GallerySection section={section} design={design} project={project} />;
    case 'invitation':
      return <InvitationSection section={section} design={design} project={project} />;
    case 'rsvp':
      return <RSVPSection section={section} design={design} project={project} />;
    case 'wall':
      return <WallSection section={section} design={design} project={project} />;
    case 'footer':
      return <FooterSection section={section} design={design} project={project} />;
    default:
      return null;
  }
};
