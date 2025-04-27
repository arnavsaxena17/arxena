import { TableStateColumns } from "@/activities/chats/components/chat-table/TableStateColumns";
import { TableState } from "@/activities/chats/components/SingleJobView";
import { CandidateNode } from "twenty-shared";


export const CandidateArrProcessing = ({ candidates, excludedFields, urlFields, tableState }: { candidates: CandidateNode[], excludedFields: string[], urlFields: string[], tableState: TableState }) => {
    const { baseColumns, contactColumns, profileColumns, urlRenderer, simpleRenderer, phoneRenderer, emailRenderer } = TableStateColumns({ tableState });

      // Process candidates data to generate dynamic columns
      const fieldNamesSet = new Set<string>();
      const baseDataFieldNamesSet = new Set<string>();
      const availableCandidates:CandidateNode[] = candidates

      availableCandidates.forEach(candidate => {
        // Process candidateFieldValues
        const candidateFieldEdges = candidate.candidateFieldValues?.edges;
        if (candidateFieldEdges) {
          candidateFieldEdges.forEach(edge => {
            if (edge.node?.candidateFields?.name) {
              const fieldName = edge?.node?.candidateFields?.name.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
              if (!excludedFields.includes(fieldName)) {
                fieldNamesSet.add(fieldName);
              }
            }
          });
        }
        
        // Process base data properties
        if (candidate) {
          // Type assertion with proper conversion through unknown first
          const candidateObj = candidate as unknown as Record<string, unknown>;
          
          // Get properties from the candidate to determine base data fields
          Object.keys(candidateObj).forEach(key => {
            if (!excludedFields.includes(key) && typeof candidateObj[key] !== 'object') {
              baseDataFieldNamesSet.add(key);
            }
          });
          
          // Also add chat control fields we know exist in baseData
          const chatControlFields = [
            'startChat', 'startChatCompleted', 
            'stopChat', 'stopChatCompleted', 'phoneNumber',
            'startMeetingSchedulingChat', 'startMeetingSchedulingChatCompleted',
            'stopMeetingSchedulingChat', 'stopMeetingSchedulingChatCompleted',
            'startVideoInterviewChat', 'startVideoInterviewChatCompleted',
            'stopVideoInterviewChat', 'stopVideoInterviewChatCompleted'
          ];
          
          chatControlFields.forEach(field => {
            baseDataFieldNamesSet.add(field);
          });
        }
      });

      // Create dynamic columns for candidateFieldValues fields
      const dynamicColumns =  Array.from(fieldNamesSet).map( (fieldName) => {
        // Format the title: convert camelCase to Title Case With Spaces
        const formattedTitle = fieldName
          // Insert space before capital letters and uppercase the first letter
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        
        // Check if this field should be rendered as URL
        const isUrl = urlFields.some(urlField => 
          fieldName.toLowerCase().includes(urlField.toLowerCase())
        );
        
        return {
          data: fieldName,
          title: formattedTitle,
          type: 'text',
          width: 150,
          renderer: isUrl ? urlRenderer : simpleRenderer,
        };
      });
      
      // Create dynamic columns for base data fields
      const baseDataColumns = Array.from(baseDataFieldNamesSet).map( (fieldName) => {
        // Format the title: convert camelCase to Title Case With Spaces
        const formattedTitle = fieldName
          // Insert space before capital letters and uppercase the first letter
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        
        // Check if this field should be rendered as URL
        const isUrl = urlFields.some(urlField => 
          fieldName.toLowerCase().includes(urlField.toLowerCase())
        );
        
        return {
          data: fieldName,
          title: formattedTitle,
          type: 'text',
          width: 150,
          renderer: isUrl ? urlRenderer : simpleRenderer,
        };
      });

      // Combine all columns
      const generatedColumnsList =[
        ...baseColumns,
        contactColumns[0],
        ...dynamicColumns,
        ...profileColumns,
        contactColumns[1],
        ...baseDataColumns.filter(col => 
          col.data !== 'jobTitle' && col.data !== 'company'
        )
      ];

      return {
        dynamicColumns,
        baseDataColumns,
        generatedColumnsList
      };
};
