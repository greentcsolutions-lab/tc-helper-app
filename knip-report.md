Unused files (30)
src/app/dashboard/PastResultsClient.tsx                                  
src/components/settings/AIGeneratedTasksSettings.tsx                     
src/components/teams/index.ts                                            
src/components/teams/MemberList.tsx                                      
src/components/teams/TaskAssignment.tsx                                  
src/components/transactions/TransactionCard.tsx                          
src/components/ui/dropdown-menu.tsx                                      
src/components/ui/PremiumCard.tsx                                        
src/components/ui/ThemeToggle.tsx                                        
src/components/ui/upload/actions-bar.tsx                                 
src/hooks/use-mobile.ts                                                  
src/lib/extraction/extract/form-definitions.ts                           
src/lib/extraction/extract/second-turn-boost.ts                          
src/lib/extraction/extract/universal.ts                                  
src/lib/extraction/extract/universal/helpers/address-validation.ts       
src/lib/extraction/extract/universal/helpers/counter-detection.ts        
src/lib/extraction/extract/universal/helpers/document-priority.ts        
src/lib/extraction/extract/universal/helpers/enrichment.ts               
src/lib/extraction/extract/universal/helpers/field-sources.ts            
src/lib/extraction/extract/universal/helpers/loan-type-normalization.ts  
src/lib/extraction/extract/universal/helpers/merge.ts                    
src/lib/extraction/extract/universal/helpers/type-coercion.ts            
src/lib/extraction/extract/universal/helpers/validation.ts               
src/lib/extraction/extract/universal/post-processor.ts                   
src/lib/extraction/mistral/extractPdf.ts                                 
src/lib/extraction/mistral/mistralClient.ts                              
src/lib/extraction/mistral/schema.ts                                     
src/lib/extraction/schema.ts                                             
src/lib/progress.ts                                                      
src/lib/stripe.ts                                                        
Unused dependencies (9)
@prisma/extension-accelerate   package.json:26:6
@radix-ui/react-dropdown-menu  package.json:30:6
canvas                         package.json:48:6
claude                         package.json:51:6
openai                         package.json:59:6
pdf-lib                        package.json:60:6
sharp                          package.json:64:6
tailwindcss-animate            package.json:67:6
zod                            package.json:70:6
Unlisted dependencies (1)
google-auth-library  src/lib/google-calendar/client.ts:5:31
Unlisted binaries (1)
prisma  package.json
Unused exports (56)
CreateTemplateDialog                                     src/components/settings/CreateTemplateDialog.tsx:373:10        
badgeVariants                                            src/components/ui/badge.tsx:46:17                              
buttonVariants                                           src/components/ui/button.tsx:60:18                             
CardFooter                                               src/components/ui/card.tsx:87:3                                
CardAction                                               src/components/ui/card.tsx:89:3                                
DialogClose                                              src/components/ui/dialog.tsx:136:3                             
DialogOverlay                                            src/components/ui/dialog.tsx:141:3                             
DialogPortal                                             src/components/ui/dialog.tsx:142:3                             
SelectGroup                                              src/components/ui/select.tsx:176:3                             
SelectLabel                                              src/components/ui/select.tsx:180:3                             
SelectSeparator                                          src/components/ui/select.tsx:182:3                             
SelectScrollUpButton                                     src/components/ui/select.tsx:183:3                             
SelectScrollDownButton                                   src/components/ui/select.tsx:184:3                             
TableFooter                                              src/components/ui/table.tsx:111:3                              
TableCaption                                             src/components/ui/table.tsx:115:3                              
Toggle                                                   src/components/ui/toggle.tsx:47:10                             
STATE_NAME_TO_CODE                                       src/lib/address/state-utils.ts:18:14                           
isValidStateCode                               function  src/lib/address/state-utils.ts:125:17                          
addBusinessDays                                function  src/lib/date-utils.ts:28:17                                    
addCalendarDaysWithAdjustment                  function  src/lib/date-utils.ts:48:17                                    
isValidISODate                                 function  src/lib/date-utils.ts:110:17                                   
getUpcomingEvents                              function  src/lib/dates/extract-timeline-events.ts:327:17                
extractStateFromAddress                        function  src/lib/dates/timezone-utils.ts:77:17                          
formatDateInTimezone                           function  src/lib/dates/timezone-utils.ts:168:17                         
logDataShape                       ParseLogg…  function  src/lib/debug/parse-logger.ts:5:17                             
mergeDetectedPages                             function  src/lib/extraction/classify/post-processor.ts:12:17            
buildLabeledCriticalImages                     function  src/lib/extraction/classify/post-processor.ts:219:17           
calculateEffectiveDate                         function  src/lib/extraction/extract/universal/helpers/date-utils.ts:9:17
normalizeDates                                 function  …/lib/extraction/extract/universal/helpers/date-utils.ts:117:17
raceAIProviders                                function  src/lib/extraction/shared/ai-race.ts:40:23                     
detectSchedulingConflicts                      function  src/lib/google-calendar/ai-inference.ts:91:23                  
suggestTaskScheduling                          function  src/lib/google-calendar/ai-inference.ts:117:23                 
getOAuth2Client                                function  src/lib/google-calendar/client.ts:61:17                        
refreshAccessToken                             function  src/lib/google-calendar/client.ts:99:23                        
extractPotentialAddresses                      function  src/lib/google-calendar/property-matcher.ts:150:17             
normalizeAddress                               function  src/lib/google-calendar/property-matcher.ts:169:17             
deleteTimelineEventsFromCalendar               function  src/lib/google-calendar/sync-timeline-events.ts:253:23         
coerceStringArray                              function  src/lib/grok/type-coercion.ts:52:17                            
coerceBoolean                                  function  src/lib/grok/type-coercion.ts:118:17                           
coerceObject                                   function  src/lib/grok/type-coercion.ts:154:17                           
trackCoercion                                  function  src/lib/grok/type-coercion.ts:186:17                           
isEmpty                                        function  src/lib/grok/type-coercion.ts:223:17                           
getTypeName                                    function  src/lib/grok/type-coercion.ts:235:17                           
deleteTimelineTasks                            function  src/lib/tasks/sync-timeline-tasks.ts:607:23                    
formatTimelineField                            function  src/lib/timeline/timeline-formatter.ts:29:17                   
TIMELINE_FIELDS                                          src/lib/timeline/timeline-formatter.ts:109:14                  
formatStructuredTimelineEvent                  function  src/lib/timeline/timeline-formatter.ts:147:17                  
formatAllStructuredTimelineEvents              function  src/lib/timeline/timeline-formatter.ts:180:17                  
bufferToBlob                                   function  src/lib/utils.ts:9:17                                          
getWhopApiKey                                  function  src/lib/whop.ts:67:17                                          
getWhopWebhookSecret                           function  src/lib/whop.ts:78:17                                          
checkParseReset                                function  src/lib/whop.ts:162:17                                         
CALENDAR_COLORS                                          src/types/calendar.ts:154:14                                   
DUE_DATE_TYPES                                           src/types/task.ts:37:14                                        
isTaskOverdue                                  function  src/types/task.ts:138:17                                       
getTaskTypeFromTimelineEventType               function  src/types/task.ts:190:17                                       
Unused exported types (19)
PreviewPage                  type       src/components/ui/upload/types.ts:4:13         
OcrPage                      interface  src/lib/extraction/mistral/classifyPdf.ts:13:18
TimelineFieldSource          interface  src/lib/timeline/timeline-formatter.ts:8:18    
TimelineFieldConfig          interface  src/lib/timeline/timeline-formatter.ts:90:18   
PlanType                     type       src/lib/whop.ts:24:13                          
PlanConfig                   interface  src/lib/whop.ts:27:18                          
CalendarSettings             interface  src/types/calendar.ts:8:18                     
CalendarEvent                interface  src/types/calendar.ts:45:18                    
GoogleCalendarEventDateTime  interface  src/types/calendar.ts:76:18                    
GoogleCalendarEvent          interface  src/types/calendar.ts:82:18                    
GoogleCalendar               interface  src/types/calendar.ts:98:18                    
SyncOperation                interface  src/types/calendar.ts:111:18                   
SyncResult                   interface  src/types/calendar.ts:119:18                   
ClassifierOutput             interface  src/types/classification.ts:21:18              
PerPageExtraction            interface  src/types/extraction.ts:11:18                  
MergeResult                  interface  src/types/extraction.ts:130:18                 
DueDateType                  type       src/types/task.ts:43:13                        
Task                         interface  src/types/task.ts:49:18                        
AITimelineExtraction         interface  src/types/timeline.ts:150:18                   
Duplicate exports (1)
db|prisma  src/lib/prisma.ts
