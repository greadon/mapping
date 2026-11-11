// Fictional data for an explicit demonstration; never mixed into connected data.
export const demo = {
  event:{eventId:'demo',name:'Forest Rally · demonstration',units:'km'},
  stages:[{stageId:'1',identifier:'SS1',name:'North Forest',status:'Planning',units:'km'},{stageId:'2',identifier:'SS2',name:'Lakeside',status:'Planning',units:'km'}],
  allocations:[
    {stageId:'1',locationId:'11',roleId:'1',personId:'1',personName:'Alex Morgan',roleName:'Marshal',invitationStatus:'Allocated',alreadySignedOn:true},
    {stageId:'1',locationId:'11',roleId:'2',personId:'2',personName:'Jamie Taylor',roleName:'Radio Marshal',callSign:'Radio 1',invitationStatus:'Allocated'},
    {stageId:'1',locationId:'12',roleId:'1',personId:'3',personName:'Sam Ellis',roleName:'Marshal',invitationStatus:'Allocated'},
    {stageId:'2',locationId:'21',roleId:'1',personId:'4',personName:'Robin Lee',roleName:'Marshal',invitationStatus:'Allocated'}
  ],
  details:{
    '1':{roles:[{roleId:'1',name:'Marshal'},{roleId:'2',name:'Radio Marshal'}],locations:[
      {locationId:'11',name:'Start',distance:0,latitude:52.752,longitude:-3.876,mandatoryRadio:true,requirements:[{roleId:'1',minimumQty:1},{roleId:'2',minimumQty:1}]},
      {locationId:'12',name:'Forest junction',distance:2.4,latitude:52.768,longitude:-3.849,comment:'Access via the northern forest gate.',requirements:[{roleId:'1',minimumQty:3}]},
      {locationId:'13',name:'Stop',distance:5.1,latitude:52.779,longitude:-3.824,dataLocation:true,requirements:[]},
      {locationId:'14',name:'Spectator access',latitude:null,longitude:null,requirements:[{roleId:'1',minimumQty:2}]}
    ]},
    '2':{roles:[{roleId:'1',name:'Marshal'}],locations:[
      {locationId:'21',name:'Start',distance:0,latitude:52.737,longitude:-3.837,requirements:[{roleId:'1',minimumQty:1}]},
      {locationId:'22',name:'Lakeside junction',distance:3.2,latitude:52.722,longitude:-3.807,requirements:[{roleId:'1',minimumQty:2}]},
      {locationId:'23',name:'Stop',distance:6.8,latitude:52.716,longitude:-3.776,requirements:[]}
    ]}
  }
};
