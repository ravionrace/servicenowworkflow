// Workflow Report Generator - Multiple output formats

var WorkflowReportGenerator = {
    
    // Generate detailed HTML report
    generateHTMLReport: function(workflows) {
        var html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>ServiceNow Workflow Documentation</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .workflow { border: 1px solid #ddd; margin: 20px 0; padding: 15px; }
                .workflow-header { background: #f5f5f5; padding: 10px; margin: -15px -15px 15px -15px; }
                .section { margin: 10px 0; }
                .section-title { font-weight: bold; color: #333; }
                .trigger, .activity { margin: 5px 0; padding: 5px; background: #f9f9f9; }
                .stats { display: flex; gap: 20px; }
                .stat { background: #e3f2fd; padding: 10px; border-radius: 4px; }
                .unused { border-left: 5px solid #f44336; }
                .active { border-left: 5px solid #4caf50; }
            </style>
        </head>
        <body>
            <h1>ServiceNow Workflow Documentation</h1>
            <p>Generated on: ${new GlideDateTime().getDisplayValue()}</p>
            <p>Total Workflows: ${workflows.length}</p>
        `;
        
        workflows.forEach(function(wf) {
            var statusClass = (wf.triggers.length === 0 && wf.statistics.total_executions == 0) ? 'unused' : 'active';
            
            html += `
            <div class="workflow ${statusClass}">
                <div class="workflow-header">
                    <h2>${wf.name}</h2>
                    <p><strong>Table:</strong> ${wf.table} | <strong>Active:</strong> ${wf.active}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">Description:</div>
                    <p>${wf.description || 'No description provided'}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">Statistics:</div>
                    <div class="stats">
                        <div class="stat">Executions: ${wf.statistics.total_executions}</div>
                        <div class="stat">Active Contexts: ${wf.statistics.active_contexts}</div>
                        <div class="stat">Last Executed: ${wf.statistics.last_executed || 'Never'}</div>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Triggers (${wf.triggers.length}):</div>
                    ${wf.triggers.map(trigger => `
                        <div class="trigger">
                            <strong>${trigger.type}:</strong> ${trigger.name} 
                            ${trigger.table ? '(Table: ' + trigger.table + ')' : ''}
                            ${trigger.when ? ' - When: ' + trigger.when : ''}
                        </div>
                    `).join('')}
                    ${wf.triggers.length === 0 ? '<p>No triggers found</p>' : ''}
                </div>
                
                <div class="section">
                    <div class="section-title">Activities (${wf.activities.length}):</div>
                    ${wf.activities.map((activity, index) => `
                        <div class="activity">
                            ${index + 1}. <strong>${activity.name}</strong> (${activity.type})
                            ${activity.description ? '<br>Description: ' + activity.description : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="section">
                    <div class="section-title">References (${wf.references.length}):</div>
                    ${wf.references.map(ref => `
                        <div class="trigger">
                            <strong>${ref.type}:</strong> ${ref.name}
                        </div>
                    `).join('')}
                    ${wf.references.length === 0 ? '<p>No external references found</p>' : ''}
                </div>
                
                <div class="section">
                    <div class="section-title">Metadata:</div>
                    <p><strong>Created:</strong> ${wf.created} by ${wf.created_by}</p>
                    <p><strong>Updated:</strong> ${wf.updated} by ${wf.updated_by}</p>
                    <p><strong>Sys ID:</strong> ${wf.sys_id}</p>
                </div>
            </div>
            `;
        });
        
        html += '</body></html>';
        return html;
    },
    
    // Generate Excel-compatible CSV with multiple sheets worth of data
    generateAdvancedCSV: function(workflows) {
        var reports = {
            summary: this.generateSummaryCSV(workflows),
            triggers: this.generateTriggersCSV(workflows),
            activities: this.generateActivitiesCSV(workflows),
            unused: this.generateUnusedWorkflowsCSV(workflows)
        };
        
        return reports;
    },
    
    generateSummaryCSV: function(workflows) {
        var csv = 'Name,Table,Description,Active,Created,Created By,Updated,Updated By,Total Executions,Active Contexts,Last Executed,Triggers Count,Activities Count,References Count,Status\n';
        
        workflows.forEach(function(wf) {
            var status = 'Active';
            if (wf.triggers.length === 0 && wf.statistics.total_executions == 0) {
                status = 'Potentially Unused';
            } else if (!wf.active) {
                status = 'Inactive';
            }
            
            csv += [
                '"' + wf.name.replace(/"/g, '""') + '"',
                '"' + wf.table + '"',
                '"' + (wf.description || '').replace(/"/g, '""') + '"',
                wf.active,
                wf.created,
                wf.created_by,
                wf.updated,
                wf.updated_by,
                wf.statistics.total_executions,
                wf.statistics.active_contexts,
                wf.statistics.last_executed || 'Never',
                wf.triggers.length,
                wf.activities.length,
                wf.references.length,
                status
            ].join(',') + '\n';
        });
        
        return csv;
    },
    
    generateTriggersCSV: function(workflows) {
        var csv = 'Workflow Name,Workflow Table,Trigger Type,Trigger Name,Trigger Table,When,Condition\n';
        
        workflows.forEach(function(wf) {
            if (wf.triggers.length > 0) {
                wf.triggers.forEach(function(trigger) {
                    csv += [
                        '"' + wf.name.replace(/"/g, '""') + '"',
                        '"' + wf.table + '"',
                        '"' + trigger.type + '"',
                        '"' + trigger.name.replace(/"/g, '""') + '"',
                        '"' + (trigger.table || '') + '"',
                        '"' + (trigger.when || '') + '"',
                        '"' + (trigger.condition || '').replace(/"/g, '""') + '"'
                    ].join(',') + '\n';
                });
            } else {
                csv += '"' + wf.name.replace(/"/g, '""') + '","' + wf.table + '","No Triggers","","","",""\n';
            }
        });
        
        return csv;
    },
    
    generateActivitiesCSV: function(workflows) {
        var csv = 'Workflow Name,Activity Order,Activity Name,Activity Type,Condition,Description\n';
        
        workflows.forEach(function(wf) {
            if (wf.activities.length > 0) {
                wf.activities.forEach(function(activity) {
                    csv += [
                        '"' + wf.name.replace(/"/g, '""') + '"',
                        activity.order,
                        '"' + activity.name.replace(/"/g, '""') + '"',
                        '"' + activity.type + '"',
                        '"' + (activity.condition || '').replace(/"/g, '""') + '"',
                        '"' + (activity.description || '').replace(/"/g, '""') + '"'
                    ].join(',') + '\n';
                });
            }
        });
        
        return csv;
    },
    
    generateUnusedWorkflowsCSV: function(workflows) {
        var csv = 'Name,Table,Created,Created By,Last Updated,Reason\n';
        
        workflows.forEach(function(wf) {
            var reasons = [];
            if (wf.triggers.length === 0) reasons.push('No Triggers');
            if (wf.statistics.total_executions == 0) reasons.push('Never Executed');
            if (wf.references.length === 0) reasons.push('No References');
            if (!wf.active) reasons.push('Inactive');
            
            if (reasons.length > 0) {
                csv += [
                    '"' + wf.name.replace(/"/g, '""') + '"',
                    '"' + wf.table + '"',
                    wf.created,
                    wf.created_by,
                    wf.updated,
                    '"' + reasons.join(', ') + '"'
                ].join(',') + '\n';
            }
        });
        
        return csv;
    },
    
    // Generate JSON report for API consumption
    generateJSONReport: function(workflows) {
        var report = {
            generated_on: new GlideDateTime().getDisplayValue(),
            total_workflows: workflows.length,
            summary: {
                active_workflows: workflows.filter(wf => wf.active === 'true').length,
                inactive_workflows: workflows.filter(wf => wf.active === 'false').length,
                potentially_unused: workflows.filter(wf => wf.triggers.length === 0 && wf.statistics.total_executions == 0).length,
                total_executions: workflows.reduce((sum, wf) => sum + parseInt(wf.statistics.total_executions || 0), 0)
            },
            workflows: workflows
        };
        
        return JSON.stringify(report, null, 2);
    }
};

// Usage Examples:

// 1. Process first 10 workflows for testing
gs.info('Starting workflow analysis...');
var testWorkflows = BatchWorkflowProcessor.processBatch(0, 10);

// 2. Generate different report formats
var csvReports = WorkflowReportGenerator.generateAdvancedCSV(testWorkflows);
gs.info('Summary CSV:\n' + csvReports.summary);

// 3. Generate JSON report
var jsonReport = WorkflowReportGenerator.generateJSONReport(testWorkflows);
gs.info('JSON Report generated (first 1000 chars):\n' + jsonReport.substring(0, 1000));

// 4. For production use with all workflows:
// var allWorkflows = WorkflowDocumenter.documentAllWorkflows();
// var fullReport = WorkflowReportGenerator.generateAdvancedCSV(allWorkflows);

gs.info('Report generation completed.');
