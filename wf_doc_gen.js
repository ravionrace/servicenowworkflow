// ServiceNow Background Script for Workflow Documentation
// Run this in Scripts - Background to generate comprehensive workflow documentation

var WorkflowDocumenter = {
    
    // Main function to document all workflows
    documentAllWorkflows: function() {
        var workflows = [];
        var gr = new GlideRecord('wf_workflow_version');
        gr.addQuery('published', true); // Only published workflows
        gr.orderBy('name');
        gr.query();
        
        while (gr.next()) {
            var workflowDoc = this.getWorkflowDetails(gr);
            workflows.push(workflowDoc);
        }
        
        gs.info('Total workflows documented: ' + workflows.length);
        return workflows;
    },
    
    // Get detailed information for a single workflow
    getWorkflowDetails: function(workflowGR) {
        var workflow = {
            sys_id: workflowGR.sys_id.toString(),
            name: workflowGR.name.toString(),
            table: workflowGR.table.toString(),
            description: workflowGR.description.toString(),
            active: workflowGR.active.toString(),
            created: workflowGR.sys_created_on.toString(),
            created_by: workflowGR.sys_created_by.toString(),
            updated: workflowGR.sys_updated_on.toString(),
            updated_by: workflowGR.sys_updated_by.toString(),
            
            // Get workflow triggers/callers
            triggers: this.getWorkflowTriggers(workflowGR.sys_id.toString()),
            
            // Get workflow activities
            activities: this.getWorkflowActivities(workflowGR.sys_id.toString()),
            
            // Get runtime statistics
            statistics: this.getWorkflowStatistics(workflowGR.sys_id.toString()),
            
            // Get references from other scripts
            references: this.findWorkflowReferences(workflowGR.sys_id.toString(), workflowGR.name.toString())
        };
        
        return workflow;
    },
    
    // Find all triggers that can start this workflow
    getWorkflowTriggers: function(workflowSysId) {
        var triggers = [];
        
        // Check business rules
        var brGR = new GlideRecord('sys_script');
        brGR.addQuery('script', 'CONTAINS', workflowSysId);
        brGR.addOrCondition('script', 'CONTAINS', 'workflow.startFlow');
        brGR.query();
        
        while (brGR.next()) {
            if (brGR.script.toString().indexOf(workflowSysId) > -1) {
                triggers.push({
                    type: 'Business Rule',
                    name: brGR.name.toString(),
                    table: brGR.table.toString(),
                    when: brGR.when.toString(),
                    condition: brGR.condition.toString(),
                    sys_id: brGR.sys_id.toString()
                });
            }
        }
        
        // Check UI Actions
        var uiGR = new GlideRecord('sys_ui_action');
        uiGR.addQuery('script', 'CONTAINS', workflowSysId);
        uiGR.query();
        
        while (uiGR.next()) {
            triggers.push({
                type: 'UI Action',
                name: uiGR.action_name.toString(),
                table: uiGR.table.toString(),
                condition: uiGR.condition.toString(),
                sys_id: uiGR.sys_id.toString()
            });
        }
        
        return triggers;
    },
    
    // Get workflow activities and their details
    getWorkflowActivities: function(workflowSysId) {
        var activities = [];
        var actGR = new GlideRecord('wf_activity');
        actGR.addQuery('workflow_version', workflowSysId);
        actGR.orderBy('order');
        actGR.query();
        
        while (actGR.next()) {
            activities.push({
                name: actGR.name.toString(),
                type: actGR.activity_definition.getDisplayValue(),
                order: actGR.order.toString(),
                condition: actGR.condition.toString(),
                description: actGR.description.toString(),
                sys_id: actGR.sys_id.toString()
            });
        }
        
        return activities;
    },
    
    // Get workflow execution statistics
    getWorkflowStatistics: function(workflowSysId) {
        var stats = {
            total_executions: 0,
            active_contexts: 0,
            last_executed: '',
            avg_duration: 0
        };
        
        // Count total executions from context table
        var contextGR = new GlideAggregate('wf_context');
        contextGR.addQuery('workflow_version', workflowSysId);
        contextGR.addAggregate('COUNT');
        contextGR.query();
        
        if (contextGR.next()) {
            stats.total_executions = contextGR.getAggregate('COUNT');
        }
        
        // Count active contexts
        var activeGR = new GlideAggregate('wf_context');
        activeGR.addQuery('workflow_version', workflowSysId);
        activeGR.addQuery('state', 'executing');
        activeGR.addAggregate('COUNT');
        activeGR.query();
        
        if (activeGR.next()) {
            stats.active_contexts = activeGR.getAggregate('COUNT');
        }
        
        // Get last execution date
        var lastGR = new GlideRecord('wf_context');
        lastGR.addQuery('workflow_version', workflowSysId);
        lastGR.orderByDesc('sys_created_on');
        lastGR.setLimit(1);
        lastGR.query();
        
        if (lastGR.next()) {
            stats.last_executed = lastGR.sys_created_on.toString();
        }
        
        return stats;
    },
    
    // Find references to workflow in various script tables
    findWorkflowReferences: function(workflowSysId, workflowName) {
        var references = [];
        var searchTables = [
            {table: 'sys_script_include', script_field: 'script', type: 'Script Include'},
            {table: 'sys_script_client', script_field: 'script', type: 'Client Script'},
            {table: 'sysevent_email_action', script_field: 'message_html', type: 'Email Notification'},
            {table: 'sys_ws_operation', script_field: 'operation_script', type: 'REST API'},
            {table: 'sysauto_script', script_field: 'script', type: 'Scheduled Job'},
            {table: 'sys_transform_script', script_field: 'script', type: 'Transform Script'}
        ];
        
        searchTables.forEach(function(tableInfo) {
            var gr = new GlideRecord(tableInfo.table);
            gr.addQuery(tableInfo.script_field, 'CONTAINS', workflowSysId);
            gr.addOrCondition(tableInfo.script_field, 'CONTAINS', workflowName);
            gr.query();
            
            while (gr.next()) {
                references.push({
                    type: tableInfo.type,
                    name: gr.name ? gr.name.toString() : gr.sys_id.toString(),
                    table: gr.table ? gr.table.toString() : '',
                    sys_id: gr.sys_id.toString()
                });
            }
        });
        
        return references;
    },
    
    // Generate CSV export of workflow documentation
    generateCSVReport: function() {
        var workflows = this.documentAllWorkflows();
        var csvContent = 'Workflow Name,Table,Description,Active,Created,Created By,Total Executions,Last Executed,Triggers Count,Activities Count\n';
        
        workflows.forEach(function(wf) {
            csvContent += '"' + wf.name + '","' + wf.table + '","' + wf.description.replace(/"/g, '""') + '","' + 
                         wf.active + '","' + wf.created + '","' + wf.created_by + '","' + 
                         wf.statistics.total_executions + '","' + wf.statistics.last_executed + '","' + 
                         wf.triggers.length + '","' + wf.activities.length + '"\n';
        });
        
        gs.info('CSV Report Generated');
        gs.info(csvContent);
        return csvContent;
    },
    
    // Find potentially unused workflows
    findUnusedWorkflows: function() {
        var workflows = this.documentAllWorkflows();
        var unusedWorkflows = [];
        
        workflows.forEach(function(wf) {
            if (wf.triggers.length === 0 && wf.references.length === 0 && wf.statistics.total_executions == 0) {
                unusedWorkflows.push({
                    name: wf.name,
                    table: wf.table,
                    sys_id: wf.sys_id,
                    created: wf.created,
                    created_by: wf.created_by
                });
            }
        });
        
        gs.info('Potentially unused workflows found: ' + unusedWorkflows.length);
        return unusedWorkflows;
    }
};

// Execute the documentation process
gs.info('Starting workflow documentation process...');

// Option 1: Get full documentation for all workflows (WARNING: This may take time with 2000 workflows)
// var allWorkflows = WorkflowDocumenter.documentAllWorkflows();

// Option 2: Generate CSV report
// var csvReport = WorkflowDocumenter.generateCSVReport();

// Option 3: Find potentially unused workflows first
var unusedWorkflows = WorkflowDocumenter.findUnusedWorkflows();

// Option 4: Document specific workflow by sys_id
// var specificWorkflow = WorkflowDocumenter.getWorkflowDetails(new GlideRecord('wf_workflow_version').get('your_workflow_sys_id'));

gs.info('Workflow documentation process completed.');
