import { UIListbox, UIPanel, UIRow, UISelect, UISpan, UIText, UIInput } from './libs/ui.js';

import { FolderUtils } from "./FolderUtils.js"

function SidebarFolder( editor ) {

	var mCurrentPath = "../../examples/models/obj/";

	const config = editor.config;
	const strings = editor.strings;

	const container = new UISpan();

	const settings = new UIPanel();
	settings.setBorderTop( '0' );
	settings.setPaddingTop( '20px' );
	container.add( settings );

	// current
	const currentRow = new UIRow();
	const currentOption = new UIInput(mCurrentPath);
	currentRow.add( new UIText( strings.getKey( 'sidebar/folder/current' ) ).setWidth( '90px' ) );
	currentRow.add( currentOption );
	currentOption.onChange(() => {
		var to = currentOption.getValue();
		if (to != mCurrentPath) {
			mCurrentPath = to;
			RefreshFolder();
		}
	});
	settings.add( currentRow );

	// changeOption
	const changeDefaults = {
		'open' : "Open",
		'add' : "Import",
	};
	const changeRow = new UIRow();
	const changeOption = new UISelect().setWidth( '150px' );
	changeOption.setOptions( changeDefaults );
	changeOption.setValue( 'open' );
	var isOpenMode = (() => {
		return (changeOption.getValue() == 'open');
	});
	changeRow.add( new UIText( strings.getKey( 'sidebar/folder/click' ) ).setWidth( '90px' ) );
	changeRow.add( changeOption );
	settings.add( changeRow );

	// Files in that folder:
	const filesRow = new UIRow();
	const filesList = new UIListbox();
	filesList.setItems( [ {name:"Loading " + mCurrentPath + "..."} ] );
	filesRow.add( filesList );
	settings.add( filesRow );

	// Utility methods:

	function RefreshFolder() {

		currentOption.setValue(mCurrentPath);

		FolderUtils.ShellExecute("ls -1 -p",(file_list) => {
			var files = file_list.split("\n");
			var file_list = [];
			for (var i in files) {
				var path = files[i].trim();
				if (path == "") continue;

				var item = {
					name : path,
					full_path : mCurrentPath + path,
					is_folder : path.endsWith("/"),
				};
				function add_on_click(to) {
					to.onClick = (() => {
						if (to.is_folder) {
							// change folder:
							mCurrentPath = to.full_path;
							RefreshFolder();
						} else {
							// do import/open:
							if (isOpenMode()) {
								editor.clear();
							}
							FolderUtils.DownloadBlob(to.full_path, (blob) => {
								blob.name = to.full_path;
								files = [ blob ];
								editor.loader.loadFiles( files );
							});
							
						}
					});
				}
				add_on_click(item);

				file_list.push(item);
			}
			filesList.setItems(file_list);
		}, mCurrentPath );
	}

	RefreshFolder();

	return container;

}

export { SidebarFolder };
