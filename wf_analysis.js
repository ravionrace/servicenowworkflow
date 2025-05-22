// Additional utility scripts for workflow analysis

// 1. BATCH PROCESSOR - Process workflows in batches to avoid timeouts
var BatchWorkflowProcessor = {
    
    processBatch: function(startIndex, batchSize) {
        startIndex = startIndex || 0;
        batchSize = batchSize || 50;
        
        var workflows = [];
        var gr = new GlideRecord('wf_workflow_version');
        gr.addQuery('published', true);
        gr.orderBy('name');
        gr.chooseWindow(startIndex, startIndex + batchSize);
        gr.query();
        
        var count = 0;
        while (gr.next()) {
            var workflowDoc = WorkflowDocumenter.getWorkflowDetails(gr);
            workflows.push(workflowDoc);
            count++;
            
            // Log progress
            if (count % 10 === 0) {
                gs.info('Processed ' + (startIndex + count) + ' workflows...');
            }
        }
        
        gs.info('Batch completed: ' + count + ' workflows processed');
        return workflows;
    },
    
    getTotalWorkflowCount: function() {
        var gr = new GlideRecord('wf_workflow_version');
        gr.addQuery('published', true);
        gr.query();
        return gr.getRowCount();
    }
};

// 2. WORKFLOW DEPENDENCY MAPPER
var WorkflowDependencyMapper = {
    
    findWorkflowDependencies: function(workflowSysId) {
        var dependencies = {
            calls_workflows: [],
            called_by_workflows: [],
            shared_tables: [],
            common_triggers: []
        };
        
        // Find workflows this workflow calls
        var activities = new GlideRecord('wf_activity');
        activities.addQuery('workflow_version', workflowSysId);
        activities.addQuery('activity_definition.name', 'Run Workflow');
        activities.query();
        
        while (activities.next()) {
            var vars = new GlideRecord('wf_variable_value');
            vars.addQuery('activity', activities.sys_id);
            vars.addQuery('variable.name', 'workflow');
            vars.query();
            if (vars.next()) {
                dependencies.calls_workflows.push(vars.value.toString());
            }
        }
        
        return dependencies;
    },
    
    buildDependencyMatrix: function() {
        var matrix = {};
        var gr = new GlideRecord('wf_workflow_version');
        gr.addQuery('published', true);
        gr.query();
        
        while (gr.next()) {
            matrix[gr.sys_id.toString()] = this.findWorkflowDependencies(gr.sys_id.toString());
        }
        
        return matrix;
    }
};

// 3. WORKFLOW HEALTH CHECKER
var WorkflowHealthChecker = {
    
    checkWorkflowHealth: function() {
        var healthReport = {
            errors: [],
            warnings: [],
            recommendations: []
        };
        
        // Check for workflows with no activities
        var emptyWorkflows = new GlideRecord('wf_workflow_version');
        emptyWorkflows.addQuery('published', true);
        emptyWorkflows.query();
        
        while (emptyWorkflows.next()) {
            var activityCount = new GlideRecord('wf_activity');
            activityCount.addQuery('workflow_version', emptyWorkflows.sys_id);
            activityCount.query();
            
            if (activityCount.getRowCount() === 0) {
                healthReport.errors.push({
                    type: 'Empty Workflow',
                    workflow: emptyWorkflows.name.toString(),
                    sys_id: emptyWorkflows.sys_id.toString()
                });
            }
        }
        
        // Check for stuck workflows (executing for more than 24 hours)
        var stuckWorkflows = new GlideRecord('wf_context');
        stuckWorkflows.addQuery('state', 'executing');
        var yesterday = new GlideDateTime();
        yesterday.addDaysUTC(-1);
        stuckWorkflows.addQuery('sys_created_on', '<', yesterday);
        stuckWorkflows.query();
        
        while (stuckWorkflows.next()) {
            healthReport.warnings.push({
                type: 'Long Running Workflow',
                workflow: stuckWorkflows.workflow_version.getDisplayValue(),
                context_id: stuckWorkflows.sys_id.toString(),
                running_since: stuckWorkflows.sys_created_on.toString()
            });
        }
        
        return healthReport;
    }
};

// 4. WORKFLOW MIGRATION HELPER
var WorkflowMigrationHelper = {
    
    identifyMigrationCandidates: function() {
        var candidates = {
            simple_approval_workflows: [],
            notification_only_workflows: [],
            single_activity_workflows: []
        };
        
        var gr = new GlideRecord('wf_workflow_version');
        gr.addQuery('published', true);
        gr.query();
        
        while (gr.next()) {
            var activities = new GlideRecord('wf_activity');
            activities.addQuery('workflow_version', gr.sys_id);
            activities.query();
            
            var activityTypes = [];
            while (activities.next()) {
                activityTypes.push(activities.activity_definition.name.toString());
            }
            
            // Identify simple approval workflows
            if (activityTypes.length <= 3 && 
                activityTypes.includes('Approval - User') || 
                activityTypes.includes('Approval - Group')) {
                candidates.simple_approval_workflows.push({
                    name: gr.name.toString(),
                    sys_id: gr.sys_id.toString(),
                    table: gr.table.toString()
                });
            }
            
            // Identify notification-only workflows
            if (activityTypes.every(type => type.includes('Notification') || type.includes('Email'))) {
                candidates.notification_only_workflows.push({
                    name: gr.name.toString(),
                    sys_id: gr.sys_id.toString(),
                    table: gr.table.toString()
                });
            }
            
            // Single activity workflows
            if (activityTypes.length === 1) {
                candidates.single_activity_workflows.push({
                    name: gr.name.toString(),
                    sys_id: gr.sys_id.toString(),
                    activity_type: activityTypes[0]
                });
            }
        }
        
        return candidates;
    }
};

// 5. USAGE EXAMPLES

// Process workflows in batches of 50
// var batch1 = BatchWorkflowProcessor.processBatch(0, 50);
// var batch2 = BatchWorkflowProcessor.processBatch(50, 50);

// Check workflow health
// var healthReport = WorkflowHealthChecker.checkWorkflowHealth();
// gs.info('Health Report: ' + JSON.stringify(healthReport, null, 2));

// Find migration candidates
// var migrationCandidates = WorkflowMigrationHelper.identifyMigrationCandidates();
// gs.info('Migration Candidates Found: ' + JSON.stringify(migrationCandidates, null, 2));

// Get total count first
var totalCount = BatchWorkflowProcessor.getTotalWorkflowCount();
gs.info('Total published workflows: ' + totalCount);
