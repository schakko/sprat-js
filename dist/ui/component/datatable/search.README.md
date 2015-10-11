sprat.ui.component.dataTable.searchable
=======================================
Enable search for sprat.ui.component.dataTable.

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
				<div class="box box-default collapsed-box box-solid box-search">
					<div class="box-header with-border">
						<h3 class="box-title">Input query</h3>

						<div class="box-tools pull-right">
							<button class="btn btn-box-tool" data-widget="collapse"><i class="fa fa-plus"></i></button>
						</div>
					</div>
					<div class="box-body">
						<div class="form-horizontal">
							<div class="form-group">
								<label for="q" class="col-sm-2 control-label">Query</label>

								<div class="col-sm-10">
									<input type="text" class="form-control" id="q" placeholder="your query"/>
								</div>
							</div>
						</div>
					</div>
					<div class="box-footer">
						<button type="button" class="btn btn-primary pull-right sprat-search">Search</button>
					</div>
				</div>
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
					.build();
			
			sprat.ui.component.dataTable.searchable(datatable)
					.withEndpoint('search/')
					.formAsQuery(function() {
						return {
							q: $("#q").val()
						};
			}).init();
		</script>