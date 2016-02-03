sprat.ui.component.dataTable.scopeable
======================================
Enable scoping for sprat.ui.component.dataTable.
Scoping is technique to restrict a result set for given specifications.

Usage
-----
The generic usage is straightforward:

	<head>
		<!-- CSS -->
		<link rel="stylesheet" href="datatables/media/css/jquery.dataTables.css" />
		
		<!-- add external dependencies -->
		<script type="text/javascript" src="datatables/media/js/jquery.dataTables.min.js'"></script>
		<!-- add redistributed libraries -->
		<script src="$PATH/vendor/jsonselect.js"></script>
		<!-- add Sprat dependencies -->
		<script src="$PATH/dist/wrestle.js"></script>
		<script src="$PATH/dist/ui/component/datatable.js"></script>
		<script src="$PATH/dist/ui/component/datatable/scoping.js"></script>
	</head>
	
	<body>
        <div class="box">
            <div class="box-header">
                <h3 class="box-title">Title</h3>
                <div class="box-tools">
                    <button type="button" class="btn btn-primary sprat-query">Default scope</button>
                    <button type="button" class="btn btn-default sprat-query" sprat-query-scope="scope-a">
					Scope A
                    </button>
                    <button type="button" class="btn btn-default sprat-query" sprat-query-scope="scope-b">
					Scope A
                    </button>
                </div>
            </div>
            <div class="box-body">
                <table class="table table-bordered table-hover dataTable" id="listView" role="grid">
                    <thead>
                    <tr>
                        <th sprat-datatable-property="display_name" class="sprat-datatable-is-orderable">Name</th>
                    </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
        </div>

		<script type="text/javascript">
			var endpoint = "{{ url('/api/ranchs') }}";
			var defaultProfile = "";

			var datatable = sprat.ui.component.dataTable()
					.bindTable($('#listView'))
					.toEndpoint(endpoint)
					.mapColumns({
						'horses': function (data, ctx) {
							return $.map(data.horses, function (item) {
								return item.display_name;
							});
						}
					})
					// important: we pass "false" to the build() method, to suppress the initial loading of the data
					.build(false);
			
			var decorateScoping = sprat.ui.component.dataTable.scopeable(datatable).init();
		</script>