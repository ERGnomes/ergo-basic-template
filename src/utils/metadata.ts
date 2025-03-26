// Type for parsed 721 metadata
export interface Metadata721 {
  project?: string;
  name?: string;
  traits?: Record<string, string>;
  series?: string;
  seed?: string;
  creator?: string;
  [key: string]: any;
}

/**
 * Parses 721 metadata from a string
 * @param text String containing potential 721 metadata
 * @returns Parsed metadata object or null if invalid
 */
export const parse721Metadata = (text: string): Metadata721 | null => {
  try {
    const json = JSON.parse(text);
    if (!json || !json['721']) return null;
    
    const data: Metadata721 = {};
    const content = json['721'];
    
    // Get the first key in the 721 object (usually project or token ID)
    const projectKey = Object.keys(content)[0];
    if (!projectKey) return null;
    
    const projectData = content[projectKey];
    
    // Save project name
    data.project = projectKey;
    
    // Handle different 721 formats
    if (projectData.traits) {
      // Format with explicit traits object
      data.traits = projectData.traits;
      // Look for name or identifier
      if (typeof projectData.Cybercitizen === 'string') {
        data.name = `Cybercitizen #${projectData.Cybercitizen}`;
      }
    } else {
      // Format with flattened attributes
      Object.entries(projectData).forEach(([key, value]) => {
        if (key !== 'traits') {
          data[key] = value;
        }
      });
    }
    
    return data;
  } catch (e) {
    console.error('Error parsing 721 metadata:', e);
    return null;
  }
}; 