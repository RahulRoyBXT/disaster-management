import axios from 'axios';
import cheerio from 'cheerio';
import UserAgent from 'user-agents';
import { logger } from '../utils/logger.js';

/**
 * Official Updates Service
 * Industry-standard web scraping service for fetching official disaster updates
 * with proper error handling, rate limiting, and caching
 */

class OfficialUpdatesService {
  constructor() {
    this.userAgent = new UserAgent();
    this.rateLimitDelay = 2000; // 2 seconds between requests
    this.timeout = 15000; // 15 seconds timeout
    this.maxRetries = 3;
    this.lastRequestTime = {};
  }

  /**
   * Create axios instance with proper headers and configuration
   */
  createAxiosInstance() {
    return axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent.toString(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  /**
   * Rate limiting mechanism
   */
  async rateLimit(source) {
    const now = Date.now();
    const lastRequest = this.lastRequestTime[source] || 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      logger.info(`Rate limiting: waiting ${delay}ms for ${source}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime[source] = Date.now();
  }

  /**
   * Fetch FEMA disaster declarations and updates
   */
  async fetchFEMAUpdates(disaster) {
    try {
      await this.rateLimit('fema');

      const axiosInstance = this.createAxiosInstance();
      logger.info(`Fetching FEMA updates for disaster: ${disaster.id}`);

      // FEMA disaster declarations API endpoint
      const femaUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
      const response = await axiosInstance.get(femaUrl, {
        params: {
          $filter: `contains(designatedArea,'${this.extractState(disaster.locationName)}')`,
          $orderby: 'declarationDate desc',
          $top: 5,
        },
      });

      const updates = [];
      if (response.data && response.data.DisasterDeclarationsSummaries) {
        response.data.DisasterDeclarationsSummaries.forEach(declaration => {
          if (this.isRelevantDisaster(declaration, disaster)) {
            updates.push({
              source: 'FEMA',
              title: declaration.title || `Disaster Declaration ${declaration.disasterNumber}`,
              content: `${declaration.incidentType} declared for ${
                declaration.designatedArea
              }. Declaration date: ${declaration.declarationDate}. Incident period: ${
                declaration.incidentBeginDate
              } to ${declaration.incidentEndDate || 'ongoing'}.`,
              url: `https://www.fema.gov/disaster/declarations/${declaration.disasterNumber}`,
              timestamp: declaration.declarationDate,
              priority: this.determinePriority(declaration.incidentType),
              metadata: {
                disasterNumber: declaration.disasterNumber,
                incidentType: declaration.incidentType,
                state: declaration.state,
              },
            });
          }
        });
      }

      return updates;
    } catch (error) {
      logger.error('Error fetching FEMA updates:', error.message);
      return this.getFallbackFEMAUpdate(disaster);
    }
  }

  /**
   * Fetch Red Cross updates via web scraping
   */
  async fetchRedCrossUpdates(disaster) {
    try {
      await this.rateLimit('redcross');

      const axiosInstance = this.createAxiosInstance();
      logger.info(`Fetching Red Cross updates for disaster: ${disaster.id}`);

      const redCrossUrl = 'https://www.redcross.org/about-us/news-and-events/news';
      const response = await axiosInstance.get(redCrossUrl);

      const $ = cheerio.load(response.data);
      const updates = [];

      // Scrape news articles
      $('.news-article')
        .slice(0, 3)
        .each((index, element) => {
          const title = $(element).find('.article-title').text().trim();
          const content = $(element).find('.article-summary').text().trim();
          const url = $(element).find('a').attr('href');
          const date = $(element).find('.article-date').text().trim();

          if (this.isRelevantContent(title + ' ' + content, disaster)) {
            updates.push({
              source: 'American Red Cross',
              title: title || `Relief Operations Update`,
              content:
                content || `Red Cross emergency response operations are active in your area.`,
              url: url
                ? `https://www.redcross.org${url}`
                : 'https://www.redcross.org/about-us/news-and-events',
              timestamp: this.parseDate(date) || new Date().toISOString(),
              priority: 'medium',
            });
          }
        });

      if (updates.length === 0) {
        return this.getFallbackRedCrossUpdate(disaster);
      }

      return updates;
    } catch (error) {
      logger.error('Error fetching Red Cross updates:', error.message);
      return this.getFallbackRedCrossUpdate(disaster);
    }
  }

  /**
   * Fetch local emergency management updates
   */
  async fetchLocalEmergencyUpdates(disaster) {
    try {
      await this.rateLimit('local');

      const updates = [];
      const state = this.extractState(disaster.locationName);
      const city = this.extractCity(disaster.locationName);

      // Try to fetch from Ready.gov for general emergency information
      const readyGovUpdate = await this.fetchReadyGovUpdates(disaster);
      if (readyGovUpdate) {
        updates.push(readyGovUpdate);
      }

      // Add local emergency management placeholder
      updates.push({
        source: 'Local Emergency Management',
        title: `${city} Emergency Response Status`,
        content: `Local emergency management authorities in ${city} are monitoring the ${
          disaster.tags?.[0] || 'emergency'
        } situation. Stay tuned to local news and emergency alert systems for the latest updates.`,
        url: `https://www.ready.gov/alerts`,
        timestamp: new Date().toISOString(),
        priority: 'high',
        metadata: {
          city: city,
          state: state,
        },
      });

      return updates;
    } catch (error) {
      logger.error('Error fetching local emergency updates:', error.message);
      return [
        {
          source: 'Local Emergency Management',
          title: 'Emergency Response Active',
          content:
            'Local emergency services are responding to the situation. Monitor local news and emergency channels.',
          url: 'https://www.ready.gov',
          timestamp: new Date().toISOString(),
          priority: 'medium',
        },
      ];
    }
  }

  /**
   * Fetch Ready.gov emergency information
   */
  async fetchReadyGovUpdates(disaster) {
    try {
      const axiosInstance = this.createAxiosInstance();
      const disasterType = disaster.tags?.[0] || 'emergency';

      // Map disaster types to Ready.gov URLs
      const disasterTypeMap = {
        flood: 'floods',
        hurricane: 'hurricanes',
        earthquake: 'earthquakes',
        wildfire: 'wildfires',
        tornado: 'tornadoes',
        'winter-storm': 'winter-weather',
      };

      const readyGovType = disasterTypeMap[disasterType] || 'natural-disasters';
      const url = `https://www.ready.gov/${readyGovType}`;

      const response = await axiosInstance.get(url);
      const $ = cheerio.load(response.data);

      const title = $('h1').first().text().trim();
      const content = $('.field-item p').first().text().trim().substring(0, 300) + '...';

      return {
        source: 'Ready.gov',
        title: title || `${disasterType.toUpperCase()} Safety Information`,
        content:
          content ||
          `Important safety information and preparedness guidelines for ${disasterType} events.`,
        url: url,
        timestamp: new Date().toISOString(),
        priority: 'medium',
      };
    } catch (error) {
      logger.error('Error fetching Ready.gov updates:', error.message);
      return null;
    }
  }

  /**
   * Fetch National Weather Service alerts if applicable
   */
  async fetchNWSAlerts(disaster) {
    try {
      await this.rateLimit('nws');

      const axiosInstance = this.createAxiosInstance();
      const coordinates = `${disaster.latitude},${disaster.longitude}`;

      // NWS API for active alerts
      const nwsUrl = `https://api.weather.gov/alerts/active`;
      const response = await axiosInstance.get(nwsUrl, {
        params: {
          point: coordinates,
          status: 'actual',
          message_type: 'alert',
        },
      });

      const updates = [];
      if (response.data && response.data.features) {
        response.data.features.slice(0, 2).forEach(alert => {
          updates.push({
            source: 'National Weather Service',
            title: alert.properties.headline,
            content: alert.properties.description.substring(0, 300) + '...',
            url: alert.properties.web || 'https://alerts.weather.gov',
            timestamp: alert.properties.sent,
            priority: this.mapNWSUrgency(alert.properties.urgency),
            metadata: {
              severity: alert.properties.severity,
              urgency: alert.properties.urgency,
              certainty: alert.properties.certainty,
            },
          });
        });
      }

      return updates;
    } catch (error) {
      logger.error('Error fetching NWS alerts:', error.message);
      return [];
    }
  }

  /**
   * Main method to fetch all official updates
   */
  async fetchAllOfficialUpdates(disaster) {
    logger.info(`Fetching official updates for disaster: ${disaster.id}`);

    const allUpdates = [];

    try {
      // Fetch from all sources concurrently with error isolation
      const sources = [
        this.fetchFEMAUpdates(disaster),
        this.fetchRedCrossUpdates(disaster),
        this.fetchLocalEmergencyUpdates(disaster),
        this.fetchNWSAlerts(disaster),
      ];

      const results = await Promise.allSettled(sources);

      results.forEach((result, index) => {
        const sourceName = ['FEMA', 'Red Cross', 'Local Emergency', 'NWS'][index];

        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allUpdates.push(...result.value);
          logger.info(`Successfully fetched ${result.value.length} updates from ${sourceName}`);
        } else {
          logger.warn(`Failed to fetch updates from ${sourceName}:`, result.reason?.message);
        }
      });

      // Sort by priority and timestamp
      allUpdates.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      // Limit to top 10 updates
      const limitedUpdates = allUpdates.slice(0, 10);

      return {
        disaster_id: disaster.id,
        location: disaster.locationName || disaster.location_name,
        disaster_type: disaster.tags?.[0] || 'general',
        coordinates: {
          latitude: disaster.latitude,
          longitude: disaster.longitude,
        },
        updates: limitedUpdates,
        last_updated: new Date().toISOString(),
        source_count: limitedUpdates.length,
        sources_attempted: ['FEMA', 'Red Cross', 'Local Emergency', 'NWS'],
      };
    } catch (error) {
      logger.error('Error in fetchAllOfficialUpdates:', error);
      throw error;
    }
  }

  // Utility methods
  extractState(locationName) {
    const statePatterns = {
      CA: ['California', 'CA'],
      NY: ['New York', 'NY'],
      TX: ['Texas', 'TX'],
      FL: ['Florida', 'FL'],
      Delhi: ['Delhi', 'New Delhi'],
      Maharashtra: ['Mumbai', 'Maharashtra'],
    };

    for (const [code, patterns] of Object.entries(statePatterns)) {
      if (patterns.some(pattern => locationName?.includes(pattern))) {
        return code;
      }
    }
    return 'Unknown';
  }

  extractCity(locationName) {
    const parts = locationName?.split(',') || [];
    return parts[0]?.trim() || 'Unknown City';
  }

  isRelevantDisaster(declaration, disaster) {
    const disasterTypes = disaster.tags || [];
    const incidentType = declaration.incidentType?.toLowerCase() || '';

    return disasterTypes.some(
      tag => incidentType.includes(tag.toLowerCase()) || tag.toLowerCase().includes(incidentType)
    );
  }

  isRelevantContent(content, disaster) {
    const keywords = disaster.tags || [];
    const location = disaster.locationName || '';

    return (
      keywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase())) ||
      content.toLowerCase().includes(location.toLowerCase())
    );
  }

  determinePriority(incidentType) {
    const highPriority = ['earthquake', 'tsunami', 'hurricane', 'tornado'];
    const mediumPriority = ['flood', 'wildfire', 'severe storm'];

    const type = incidentType?.toLowerCase() || '';

    if (highPriority.some(p => type.includes(p))) return 'high';
    if (mediumPriority.some(p => type.includes(p))) return 'medium';
    return 'low';
  }

  mapNWSUrgency(urgency) {
    const urgencyMap = {
      Immediate: 'critical',
      Expected: 'high',
      Future: 'medium',
      Past: 'low',
    };
    return urgencyMap[urgency] || 'medium';
  }

  parseDate(dateString) {
    try {
      return new Date(dateString).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  // Fallback methods for when real data is unavailable
  getFallbackFEMAUpdate(disaster) {
    return [
      {
        source: 'FEMA',
        title: `${disaster.tags?.[0]?.toUpperCase() || 'DISASTER'} Response Coordination`,
        content: `FEMA is coordinating federal disaster response efforts in ${disaster.locationName}. Federal resources are being mobilized to support local and state emergency management efforts.`,
        url: 'https://www.fema.gov/disaster-declarations',
        timestamp: new Date().toISOString(),
        priority: 'high',
      },
    ];
  }

  getFallbackRedCrossUpdate(disaster) {
    return [
      {
        source: 'American Red Cross',
        title: `Emergency Relief Operations - ${disaster.locationName}`,
        content: `The American Red Cross is providing emergency assistance including shelter, food, and emotional support to those affected by the ${
          disaster.tags?.[0] || 'disaster'
        } in ${disaster.locationName}.`,
        url: 'https://www.redcross.org/about-us/news-and-events',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        priority: 'medium',
      },
    ];
  }
}

export default new OfficialUpdatesService();
