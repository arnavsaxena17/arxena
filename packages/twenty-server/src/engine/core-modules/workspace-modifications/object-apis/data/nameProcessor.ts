export class NameProcessor {
    masterDataJson: any;
    titles: any;
    constructor() {
        this.masterDataJson = {
            names: {},
            first_name: '',
            last_name: '',
            middle_name: '',
            middle_initial: '',
            full_name: '',
            title: ''
        };
        
        this.titles = new Set(['dr', 'dr.', 'prof', 'prof.', 'professor', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.','ca']);
    }
  
    getUniqueStringKey(firstName, lastName, companyName) {
        if (firstName && lastName) {
            let uniqueStringKey = String(firstName) + String(lastName);
            if (companyName) {
                uniqueStringKey += String(companyName);
            }
            uniqueStringKey = uniqueStringKey.toLowerCase()
                .replace(/ /g, '')
                .replace(/,/g, '')
                .replace(/\./g, '')
                .replace(/-/g, '')
                .replace(/\n/g, '')
                .replace(/:/g, '')
                .replace(/\|/g, '');
            return uniqueStringKey;
        } else {
            return '';
        }
    }
  
    getUniqueStringKeyFromFullNameCompanyNameData(fullName, companyName) {
        if (fullName) {
            this.processName(fullName);
            const firstName = this.masterDataJson.first_name;
            const lastName = this.masterDataJson.last_name;
            
            // Generate uniqueStringKey with firstName + lastName + companyName (if available)
            let uniqueStringKey = String(firstName) + String(lastName);
            if (companyName) {
                uniqueStringKey += String(companyName);
            }
            
            uniqueStringKey = uniqueStringKey.toLowerCase()
                .replace(/ /g, '')
                .replace(/,/g, '')
                .replace(/\./g, '')
                .replace(/-/g, '')
                .replace(/\n/g, '')
                .replace(/:/g, '')
                .replace(/\|/g, '');
            
            return uniqueStringKey;
        } else {
            return '';
        }
    }
  
    processName(record) {
        try {
            
            // Get full name from record
            const fullName = this._extractFullName(record);
            
            // If name is empty or null, return empty values
            if (!fullName) {
                return this._getEmptyNameData();
            }
            
            // Process the full name - convert to title case
            const processedFullName = this._toTitleCase(fullName);
            let nameParts = this._splitName(processedFullName);
            
            // Extract title if present
            const [namePartsWithoutTitle, title] = this._extractTitle(nameParts);
            nameParts = namePartsWithoutTitle;
            
            // Process based on the remaining name parts
            if (nameParts.length === 0) {
                return this._getEmptyNameData();
            }
                
            this._processNameParts(nameParts, processedFullName, title);
            return this.masterDataJson.names;
            
        } catch (e) {
            console.log(`NameProcessor.processName: Error processing name:`, e);
            return this._getEmptyNameData();
        }
    }
  
    _extractFullName(record) {
        try {
            if (typeof record === 'string') {
                return record.trim();
            }
            return '';
        } catch (e) {
            return '';
        }
    }
  
    _toTitleCase(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }
  
    _splitName(fullName) {
        // First split by spaces
        const parts = fullName.split(' ').filter(part => part.length > 0);
        
        // Process parts for initials
        const processedParts: string[] = [];
        let i = 0;
        while (i < parts.length) {
            const current = parts[i];
            
            // Check if current and next parts are single letters (initials)
            if (i < parts.length - 1 && current.length === 1 && parts[i + 1].length === 1) {
                // Combine initials
                processedParts.push(current + parts[i + 1]);
                i += 2;
            } else {
                processedParts.push(current);
                i += 1;
            }
        }
                
        return processedParts;
    }
  
    _extractTitle(nameParts) {
        if (nameParts.length === 0) {
            return [nameParts, ''];
        }
            
        const firstPart = nameParts[0].toLowerCase().replace('.', '');
        if (this.titles.has(firstPart)) {
            return [nameParts.slice(1), nameParts[0]];
        }
        return [nameParts, ''];
    }
  
    _processNameParts(nameParts, fullName, title) {
        // Handle different name formats
        if (nameParts.length === 1) {
            this._processSinglePartName(nameParts, fullName, title);
        } else if (nameParts.length === 2) {
            this._processTwoPartName(nameParts, fullName, title);
        } else {
            this._processMultiPartName(nameParts, fullName, title);
        }
    }
  
    _processSinglePartName(nameParts, fullName, title) {
        const nameData = {
            first_name: nameParts[0],
            last_name: '',
            middle_name: '',
            middle_initial: '',
            title: title
        };
        this._updateMasterData(nameData, fullName);
    }
  
    _processTwoPartName(nameParts, fullName, title) {
        // Check if first part is initials
        const firstPart = nameParts[0];
        
        if (firstPart.length === 2 && firstPart === firstPart.toUpperCase()) {  // Likely initials
            const nameData = {
                first_name: firstPart[0],
                middle_initial: firstPart[1],
                middle_name: '',
                last_name: nameParts[1],
                title: title
            };
            this._updateMasterData(nameData, fullName);
        } else {
            const nameData = {
                first_name: nameParts[0],
                last_name: nameParts[1],
                middle_name: '',
                middle_initial: '',
                title: title
            };
            this._updateMasterData(nameData, fullName);
        }
    }
  
    _processMultiPartName(nameParts, fullName, title) {
        // Handle cases with multiple parts (including possible initials)
        if (nameParts[0].length === 1 && nameParts[1].length === 1) {  // Two initials
            const nameData = {
                first_name: nameParts[0],
                middle_initial: nameParts[1],
                middle_name: '',
                last_name: nameParts.slice(2).join(' '),
                title: title
            };
            this._updateMasterData(nameData, fullName);
        } else {
            const nameData = {
                first_name: nameParts[0],
                middle_name: nameParts[1],
                middle_initial: nameParts[1][0],
                last_name: nameParts.slice(2).join(' '),
                title: title
            };
            this._updateMasterData(nameData, fullName);
        }
    }
  
    _getEmptyNameData() {
        const emptyData = {
            first_name: '',
            last_name: '',
            middle_name: '',
            middle_initial: '',
            title: ''
        };
        this.masterDataJson.names = emptyData;
        Object.assign(this.masterDataJson, {
            first_name: '',
            last_name: '',
            middle_name: '',
            middle_initial: '',
            full_name: '',
            title: ''
        });
        return this.masterDataJson.names;
    }
  
    _updateMasterData(nameData, fullName) {
        this.masterDataJson.names = nameData;
        Object.assign(this.masterDataJson, {
            first_name: nameData.first_name,
            last_name: nameData.last_name,
            middle_name: nameData.middle_name,
            middle_initial: nameData.middle_initial,
            full_name: fullName,
            title: nameData.title
        });
    }
  }
  