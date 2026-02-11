import {Template} from 'src/types'

export const getTemplateQueryKey = (template: Template): string => {
  if (!template.query) return ''
  
  const queryObj = template.query
  const normalizedQuery = {
    db: queryObj.db || '',
    rp: queryObj.rp || '',
    measurement: queryObj.measurement || '',
    tagKey: queryObj.tagKey || '',
    fieldKey: queryObj.fieldKey || '',
    influxql: queryObj.influxql || '',
    flux: queryObj.flux || '',
  }
  
  return JSON.stringify(normalizedQuery)
}

export const detectTemplateConflicts = (templates: Template[]): Template[] => {
  const allTemplates: Template[] = []
  const templateMap = new Map<string, Template>() 
  const conflictTempVars = new Set<string>() 
  
  templates.forEach(template => {
    const queryKey = getTemplateQueryKey(template)
    const fullKey = `${template.tempVar}::${queryKey}`
    
    if (!templateMap.has(fullKey)) {
      templateMap.set(fullKey, template)
      
      const sameTempVarTemplates = allTemplates.filter(
        t => t.tempVar === template.tempVar
      )
      
      if (sameTempVarTemplates.length > 0) {
        const hasDifferentQuery = sameTempVarTemplates.some(
          t => getTemplateQueryKey(t) !== queryKey
        )
        
        if (hasDifferentQuery) {
          conflictTempVars.add(template.tempVar)
          sameTempVarTemplates.forEach(t => {
            conflictTempVars.add(t.tempVar)
          })
        }
      }
      
      allTemplates.push(template)
    }
  })
  
  return allTemplates.map(template => ({
    ...template,
    hasConflict: conflictTempVars.has(template.tempVar),
  }))
}

