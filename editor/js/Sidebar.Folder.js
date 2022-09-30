import { UIListbox, UIPanel, UIRow, UISelect, UISpan, UIText } from './libs/ui.js';

import { FolderUtils } from "./FolderUtils.js"

function SidebarFolder( editor ) {

	const config = editor.config;
	const strings = editor.strings;

	const container = new UISpan();

	const settings = new UIPanel();
	settings.setBorderTop( '0' );
	settings.setPaddingTop( '20px' );
	container.add( settings );

	// current
	const currentRow = new UIRow();
	const currentOption = new UIText("./");
	currentRow.add( new UIText( strings.getKey( 'sidebar/folder/current' ) ).setWidth( '90px' ) );
	currentRow.add( currentOption );
	settings.add( currentRow );

	// changeOption
	const changeDefaults = {
		'./' : './',
		'home': 'home (~)',
		'project': 'project',
	};
	const changeRow = new UIRow();
	const changeOption = new UISelect().setWidth( '150px' );
	changeOption.setOptions( changeDefaults );
	changeOption.setValue( './' );
	changeRow.add( new UIText( strings.getKey( 'sidebar/folder/change' ) ).setWidth( '90px' ) );
	changeRow.add( changeOption );
	settings.add( changeRow );

	// Files in that folder:
	const filesRow = new UIRow();
	const filesList = new UIListbox();
	filesList.setItems( [ {name:"Loading Files..."} ] );
	filesRow.add( filesList );
	settings.add( filesRow );

	// Utility methods:

	function RefreshFolder() {

		FolderUtils.ShellExecute("ls -1 -p",(file_list) => {
			var files = file_list.split("\n");
			var ops = { };
			ops["../"] = "../";
			var file_list = [];
			var firstKey = null;
			for (var i in files) {
				var path = files[i].trim();
				if (path == "") continue;
				firstKey = path;
				file_list.push({
					name : path
				});
				if (path.endsWith("/")) {
					ops[path] = path;
				}
			}
			changeOption.setOptions( ops );
			filesList.setItems(file_list);
		});
	}

	RefreshFolder();

	return container;

}

export { SidebarFolder };
